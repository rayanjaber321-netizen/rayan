import { oauthClient, CALENDAR_SCOPES } from "../../_lib/googleAuth.js";

export default function handler(req, res) {
  const farmId = req.query.farmId;
  if (!farmId) {
    res.status(400).send("Missing farmId");
    return;
  }

  const auth = oauthClient();
  const url = auth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...CALENDAR_SCOPES, "https://www.googleapis.com/auth/userinfo.email"],
    state: farmId,
  });

  res.writeHead(302, { Location: url });
  res.end();
}
