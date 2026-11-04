#![cfg_attr(not(target_os = "linux"), allow(dead_code))]

use serde::Deserialize;

/// Decoders WebKitGTK can use for H.264 and HEVC through GStreamer.
pub(crate) const GSTREAMER_DECODERS: [&str; 6] = [
    "nvh264dec",
    "vah264dec",
    "avdec_h264",
    "nvh265dec",
    "vah265dec",
    "avdec_h265",
];

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WebglReply {
    pub(crate) webgl2: bool,
}

/// Result of looking for GStreamer decoders. A missing tool is not the same as none.
pub(crate) enum DecoderAnswer {
    MissingTool,
    Found(Vec<&'static str>),
}

/// Package manager that owns the installed executable.
enum PackageOwner {
    Deb,
    Rpm,
    None,
}

pub(crate) struct StartupDiagnostics<'a> {
    pub(crate) package: &'a str,
    pub(crate) webkit_version: &'a str,
    pub(crate) policy: &'a str,
    pub(crate) webgl: Option<&'a WebglReply>,
    pub(crate) decoders: &'a DecoderAnswer,
}

/// Answers from the two asynchronous probes, logged once both are in.
pub(crate) struct StartupProbe {
    pub(crate) package: &'static str,
    pub(crate) webkit_version: String,
    pub(crate) policy: Option<String>,
    pub(crate) webgl: Option<Option<WebglReply>>,
    pub(crate) decoders: Option<DecoderAnswer>,
    pub(crate) dispatch_error: Option<String>,
}

impl StartupProbe {
    /// The startup line once WebGL and decoders both answered. `None` while one is pending.
    pub(crate) fn complete_line(&self) -> Option<String> {
        let policy = self.policy.as_deref()?;
        let webgl = self.webgl.as_ref()?;
        let decoders = self.decoders.as_ref()?;
        let line = format_startup_line(&StartupDiagnostics {
            package: self.package,
            webkit_version: &self.webkit_version,
            policy,
            webgl: webgl.as_ref(),
            decoders,
        });

        match self.dispatch_error.as_deref() {
            Some(error) => Some(format!("{line} dispatch failed: {error}")),
            None => Some(line),
        }
    }
}

/// One line with everything needed to tell a slow Linux GPU apart from a missing one.
pub(crate) fn format_startup_line(diagnostics: &StartupDiagnostics<'_>) -> String {
    let webgl2 = match diagnostics.webgl {
        Some(reply) if reply.webgl2 => "yes",
        Some(_) => "no",
        None => "unknown",
    };
    let decoders = match diagnostics.decoders {
        DecoderAnswer::MissingTool => "unknown (gst-inspect-1.0 not installed)".to_string(),
        DecoderAnswer::Found(names) if names.is_empty() => "none".to_string(),
        DecoderAnswer::Found(names) => names.join(","),
    };

    format!(
        "[unplatform-ai] linux diagnostics: package={} webkitgtk {} hardware-acceleration={} webgl2={} decoders={}",
        diagnostics.package,
        diagnostics.webkit_version,
        diagnostics.policy,
        webgl2,
        decoders
    )
}

/// Detects the Linux package from the AppImage variable or the owner of the executable.
pub(crate) fn detect_package() -> &'static str {
    let is_appimage = std::env::var_os("APPIMAGE").is_some_and(|value| !value.is_empty());
    let owner = std::env::current_exe()
        .ok()
        .map(|exe| detect_owner(&exe))
        .unwrap_or(PackageOwner::None);

    package_label(is_appimage, owner)
}

fn package_label(is_appimage: bool, owner: PackageOwner) -> &'static str {
    if is_appimage {
        return "appimage";
    }

    match owner {
        PackageOwner::Deb => "deb",
        PackageOwner::Rpm => "rpm",
        PackageOwner::None => "unknown",
    }
}

/// Debian and RPM install the same `/usr/bin` path, so ask each database who owns it.
fn detect_owner(exe: &std::path::Path) -> PackageOwner {
    let path = exe.to_string_lossy();
    if command_succeeds("dpkg-query", &["-S", path.as_ref()]) {
        return PackageOwner::Deb;
    }
    if command_succeeds("rpm", &["-qf", path.as_ref()]) {
        return PackageOwner::Rpm;
    }

    PackageOwner::None
}

fn command_succeeds(program: &str, args: &[&str]) -> bool {
    std::process::Command::new(program)
        .args(args)
        .output()
        .is_ok_and(|output| output.status.success())
}

/// Lists the decoders present in GStreamer. Separates a missing tool from an empty result.
#[cfg(target_os = "linux")]
pub(crate) fn detect_gstreamer_decoders() -> DecoderAnswer {
    let output = match std::process::Command::new("gst-inspect-1.0")
        .arg("--print-all")
        .output()
    {
        Ok(output) => output,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return DecoderAnswer::MissingTool;
        }
        Err(_) => return DecoderAnswer::Found(Vec::new()),
    };
    if !output.status.success() {
        return DecoderAnswer::Found(Vec::new());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let found = GSTREAMER_DECODERS
        .iter()
        .copied()
        .filter(|name| {
            text.lines().any(|line| {
                line.split(':')
                    .next()
                    .is_some_and(|element| element.trim() == *name)
            })
        })
        .collect();

    DecoderAnswer::Found(found)
}

#[cfg(test)]
mod tests {
    use super::{
        format_startup_line, package_label, DecoderAnswer, PackageOwner, StartupDiagnostics,
        WebglReply,
    };

    #[test]
    fn formats_the_gpu_startup_line() {
        let webgl = WebglReply { webgl2: true };
        let line = format_startup_line(&StartupDiagnostics {
            package: "deb",
            webkit_version: "2.52.6",
            policy: "Always",
            webgl: Some(&webgl),
            decoders: &DecoderAnswer::Found(vec!["vah264dec", "avdec_h264"]),
        });

        assert_eq!(
            line,
            "[unplatform-ai] linux diagnostics: package=deb webkitgtk 2.52.6 hardware-acceleration=Always webgl2=yes decoders=vah264dec,avdec_h264"
        );
    }

    #[test]
    fn shows_a_missing_webgl_context() {
        let webgl = WebglReply { webgl2: false };
        let line = format_startup_line(&StartupDiagnostics {
            package: "appimage",
            webkit_version: "2.50.4",
            policy: "Never",
            webgl: Some(&webgl),
            decoders: &DecoderAnswer::Found(Vec::new()),
        });

        assert_eq!(
            line,
            "[unplatform-ai] linux diagnostics: package=appimage webkitgtk 2.50.4 hardware-acceleration=Never webgl2=no decoders=none"
        );
    }

    #[test]
    fn shows_an_unanswered_webgl_probe() {
        let line = format_startup_line(&StartupDiagnostics {
            package: "rpm",
            webkit_version: "2.52.6",
            policy: "Always",
            webgl: None,
            decoders: &DecoderAnswer::Found(vec!["nvh264dec"]),
        });

        assert!(line.contains("package=rpm webkitgtk 2.52.6"), "{line}");
        assert!(line.contains("webgl2=unknown"), "{line}");
    }

    #[test]
    fn formats_a_missing_gst_inspect_tool() {
        let webgl = WebglReply { webgl2: true };
        let line = format_startup_line(&StartupDiagnostics {
            package: "deb",
            webkit_version: "2.52.6",
            policy: "Always",
            webgl: Some(&webgl),
            decoders: &DecoderAnswer::MissingTool,
        });

        assert!(
            line.contains("decoders=unknown (gst-inspect-1.0 not installed)"),
            "{line}"
        );
    }

    #[test]
    fn labels_the_install_package() {
        assert_eq!(package_label(true, PackageOwner::None), "appimage");
        assert_eq!(package_label(false, PackageOwner::Deb), "deb");
        assert_eq!(package_label(false, PackageOwner::Rpm), "rpm");
        assert_eq!(package_label(false, PackageOwner::None), "unknown");
    }
}
