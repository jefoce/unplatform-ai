# OpenRouter setup

OpenRouter runs the image and video models. Unplatform AI needs one OpenRouter API key, and you pay OpenRouter only for the images and videos you make.

| | |
|---|---|
| Time | about 3 minutes |
| Cost | pay per image or video, no subscription |
| You need | an OpenRouter account with some credit |

## 1. Add credit

Sign in at [openrouter.ai](https://openrouter.ai), then open **Account → [Credits](https://openrouter.ai/settings/credits)** and add credit. A few dollars is enough to try every model at its cheapest settings.

## 2. Create an API key

Open **Account → [API Keys](https://openrouter.ai/workspaces/default/keys) → New Key** and fill in:

- **Name:** `Unplatform AI`
- **Expiration:** shorter is safer, for example 30 days. When it ends, create a new key (this step) and paste it again.
- **Credit limit:** **Custom amount**, for example `5`. The key stops at $5 in total until you raise the limit. Set **Reset limit every** to Monthly if you want a fresh $5 each month.

Use a dedicated key for this app, with its own spend limit, rather than a key you share with other tools.

Press **Create** and copy the key. It starts with `sk-or-v1-`.

<img src="../images/openrouter-api-key.png" width="720" alt="OpenRouter New Key dialog with name, expiration and credit limit">

> [!WARNING]
> OpenRouter shows the key only once. Paste it straight into the app, not into notes or a chat.

## 3. Optional: a management key for your balance

The management key is optional. This app only reads from it: the one call is `/api/v1/credits`, and the only thing it unlocks is your account balance in the wallet pill. Without it, that balance is simply unavailable.

A spend-limited API key already reports what is left of its limit through `/api/v1/key`, and the app shows that by default. The management key only matters when you want the whole account balance.

On OpenRouter a management key can create and delete API keys. Keep it private and paste it only into the app. Open **Account → [Management Keys](https://openrouter.ai/settings/management-keys) → New Key**, give it a name and an expiration, and press **Create**.

<img src="../images/openrouter-mgmt-key.png" width="720" alt="OpenRouter Create a Management Key dialog">

> [!WARNING]
> A management key can create and delete your API keys. Paste it only into the app.

## 4. Paste the keys into the app

Press the gear icon, find **OpenRouter**, paste the API key (and the management key if you made one), press **Save**, then **Test**.

## When a key expires

- **API key:** new images and videos fail with "Your OpenRouter key is not valid." Create a new key (step 2), paste it, press **Save**.
- **Management key:** the balance disappears from the wallet pill. Create a new one (step 3).

## Something went wrong?

| What you see | What to do |
|---|---|
| Your OpenRouter key is not set. | Do step 4. |
| Your OpenRouter key is not valid. | The key expired or was deleted. Do steps 2 and 4. |
| Not enough OpenRouter credits. | Add credit (step 1), or raise the key's credit limit. |
