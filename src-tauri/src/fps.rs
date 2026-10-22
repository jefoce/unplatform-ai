use objc2::{
    msg_send,
    runtime::{AnyClass, AnyObject, Bool, Sel},
    sel,
};
use objc2_foundation::NSString;
use std::ffi::c_void;

const FEATURE: &str = "PreferPageRenderingUpdatesNear60FPSEnabled";

/// Clears WebKit's 60 fps page rendering cap. Private API, guarded at every step.
pub(crate) fn disable_60fps_cap(ptr: *mut c_void) -> bool {
    if ptr.is_null() {
        return false;
    }
    let Some(preferences_class) = AnyClass::get(c"WKPreferences") else {
        return false;
    };
    let wanted = NSString::from_str(FEATURE);

    // SAFETY: Tauri owns a live WKWebView for the duration of this call.
    unsafe {
        let webview = &*(ptr as *mut AnyObject);
        let configuration: *mut AnyObject = msg_send![webview, configuration];
        if configuration.is_null() {
            return false;
        }
        let preferences: *mut AnyObject = msg_send![&*configuration, preferences];
        if preferences.is_null() {
            return false;
        }
        let preferences = &*preferences;
        let is_preferences: bool = msg_send![preferences, isKindOfClass: preferences_class];
        if !is_preferences {
            return false;
        }

        // macOS 15 moved `_features` from the instance to the class.
        let features: *mut AnyObject = if responds(preferences, sel!(_features)) {
            msg_send![preferences, _features]
        } else if preferences_class.metaclass().responds_to(sel!(_features)) {
            msg_send![preferences_class, _features]
        } else {
            return false;
        };
        if features.is_null() {
            return false;
        }
        let features = &*features;
        if !responds(features, sel!(count)) || !responds(features, sel!(objectAtIndex:)) {
            return false;
        }

        let count: usize = msg_send![features, count];
        for index in 0..count {
            let feature: *mut AnyObject = msg_send![features, objectAtIndex: index];
            if feature.is_null() || !responds(&*feature, sel!(key)) {
                continue;
            }
            let key: *mut AnyObject = msg_send![&*feature, key];
            if key.is_null() {
                continue;
            }
            let matches: bool = msg_send![&*key, isEqualToString: &*wanted];
            if !matches || !responds(preferences, sel!(_setEnabled:forFeature:)) {
                continue;
            }
            let _: () = msg_send![
                preferences,
                _setEnabled: Bool::new(false),
                forFeature: &*feature
            ];
            return true;
        }
    }
    false
}

/// Calls `respondsToSelector:` without assuming the object implements it.
fn responds(object: &AnyObject, selector: Sel) -> bool {
    // SAFETY: `object` is a live Objective-C object from the webview.
    unsafe { msg_send![object, respondsToSelector: selector] }
}

#[cfg(test)]
mod tests {
    use super::disable_60fps_cap;
    use std::ptr;

    #[test]
    fn null_pointer_is_ignored() {
        assert!(!disable_60fps_cap(ptr::null_mut()));
    }
}
