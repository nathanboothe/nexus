# Home Dashboard — Phone Setup

This guide gets the Home Dashboard working on your phone. It takes about 5 minutes and you only do it once.

The dashboard lets you control the house — lights, the TV and receiver, and more — from your phone, whether you're home or away. It works over a private, secure connection, so there's nothing public on the internet.

There are two short parts: first you set up the Tailscale app with your own account, then you accept an invite from the home admin that gives your phone access to the dashboard.

---

## Part 1 — Install Tailscale and create your account

Tailscale is the app that securely connects your phone to our home system.

1. Install it from your phone's app store:
   - **iPhone:** open the App Store, search **Tailscale**, install it.
   - **Android:** open the Google Play Store, search **Tailscale**, install it.
2. Open the Tailscale app and **sign in with your own email** — your personal Google, Apple, or Microsoft account is fine. This creates your own Tailscale account.
3. That's all for this part. You don't need to set anything else up — you just need to have an account that exists.

> Use your **own** email here. You are not logging into someone else's account; you're making your own, which the home admin will then grant access to the dashboard.

## Part 2 — Accept the share from the home admin

Once you have a Tailscale account, the home admin sends you an invitation to access the dashboard server.

1. Tell the home admin the email address you used in Part 1.
2. The admin will send you a **share link** (by text or email), or an invitation that shows up in your Tailscale app.
3. Open the link / accept the invite. This gives your phone access to the home dashboard server.
4. After accepting, open the Tailscale app and make sure it's **connected** — there's a toggle that should be ON.

> You can leave Tailscale running all the time. It sits quietly in the background, uses almost no battery, and keeps the dashboard reachable from anywhere — home, work, on the road.

## Part 3 — Open the dashboard

In your phone's web browser (Safari, Chrome, etc.), go to this address:

```
http://100.95.164.64:8080
```

> Type it exactly — it starts with **http://** (not https), and the **:8080** at the end matters.

You should see the **Home Control** screen with buttons for different rooms and the entertainment system.

## Part 4 — Save it to your home screen (recommended)

So you don't have to type that address every time, save the dashboard as an icon:

- **iPhone (Safari):** tap the **Share** button (square with an arrow), scroll down, tap **Add to Home Screen**, then **Add**.
- **Android (Chrome):** tap the **⋮** menu (top right), tap **Add to Home screen**, then **Add**.

Now there's a Home Dashboard icon on your phone you can tap like any app.

---

## Using the dashboard

- The first screen shows **Overview** (climate, network) and **Rooms**.
- Tap any room to see its controls. Tap a light's switch to turn it on or off; slide the bar to dim it.
- The **Rec Room** has the full entertainment controls — tap a streaming service (Netflix, etc.) to turn everything on and launch it.
- Buttons marked **"soon"** aren't set up yet.

## If it's not working

1. **Open the Tailscale app and check it's connected (toggle ON).** This is the most common fix.
2. **Make sure you accepted the admin's share invite** (Part 2). Without it, your phone can't reach the dashboard. In the Tailscale app you should see the home dashboard server listed.
3. Check the address is exact: `http://100.95.164.64:8080` (http, not https; with :8080).
4. If a light won't respond, it may be offline — try again in a moment.
5. Still stuck? Tell the home admin — it may be something on the server side, not your phone.

---

*Once set up, just tap the icon and control the house.*
