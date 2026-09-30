const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

export const recoveryEmail = ({ actionLink, logoUrl }) => {
  const link = escapeHtml(actionLink);
  const logo = escapeHtml(logoUrl);
  return {
    subject: "Réinitialisation de votre mot de passe KCS EduPlanner",
    text: [
      "KINSHASA CHRISTIAN SCHOOL",
      "",
      "Une demande de réinitialisation de mot de passe a été reçue pour votre compte KCS EduPlanner.",
      "Ouvrez ce lien sécurisé : " + actionLink,
      "",
      "Ce lien est personnel et temporaire. Ignorez ce message si vous n’avez pas fait cette demande."
    ].join("\n"),
    html: '<!doctype html><html><body style="margin:0;background:#edf5fa;font-family:Arial,sans-serif;color:#142238">' +
      '<div style="display:none;max-height:0;overflow:hidden">Réinitialisez votre mot de passe KCS EduPlanner.</div>' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf5fa;padding:28px 12px"><tr><td align="center">' +
      '<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;background:#fbfdff;border:1px solid #d9e7ef">' +
      '<tr><td style="background:#071a2e;padding:22px 28px"><table role="presentation"><tr>' +
      '<td><img src="' + logo + '" width="58" height="58" alt="KCS" style="display:block;background:#fff;border-radius:6px;object-fit:contain"></td>' +
      '<td style="padding-left:16px;color:#fff"><div style="font-size:19px;font-weight:700">KCS <span style="color:#31c5ff">EduPlanner</span></div>' +
      '<div style="font-size:10px;letter-spacing:2px;color:#93a5b6;margin-top:5px">KINSHASA CHRISTIAN SCHOOL</div></td></tr></table></td></tr>' +
      '<tr><td style="position:relative;padding:38px 38px 32px;text-align:left">' +
      '<div style="text-align:center;margin-bottom:18px"><img src="' + logo + '" width="150" alt="" style="opacity:.06"></div>' +
      '<h1 style="font-size:24px;line-height:1.25;margin:0 0 14px;color:#071a2e">Réinitialisez votre mot de passe</h1>' +
      '<p style="font-size:15px;line-height:1.7;color:#52677a;margin:0 0 24px">Une demande de récupération a été reçue pour votre compte. Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.</p>' +
      '<p style="margin:0 0 25px"><a href="' + link + '" style="display:inline-block;background:#009fe0;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 22px;border-radius:6px">Choisir un nouveau mot de passe</a></p>' +
      '<p style="font-size:12px;line-height:1.6;color:#718096;margin:0">Ce lien est personnel et temporaire. Si vous n’avez pas demandé cette modification, ignorez simplement ce message.</p>' +
      '<div style="height:1px;background:#d9e7ef;margin:28px 0 18px"></div>' +
      '<p style="font-size:11px;line-height:1.5;color:#8293a3;margin:0">Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :<br><a href="' + link + '" style="color:#008bc4;word-break:break-all">' + link + '</a></p>' +
      '</td></tr><tr><td style="background:#e6f1f7;padding:17px 28px;color:#60768a;font-size:10px;text-align:center">KCS EduPlanner · Kinshasa Christian School</td></tr>' +
      '</table></td></tr></table></body></html>'
  };
};