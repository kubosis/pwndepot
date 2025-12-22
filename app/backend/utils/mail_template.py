def verification_email_html(verify_url: str, logo_cid: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Verify your email</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#ffffff;
  font-family:Consolas, 'Courier New', monospace;
">

<table width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding:48px 16px;">

      <table width="600" cellpadding="0" cellspacing="0" style="
        background:#0a0f0c;
        border:1px solid #2dd4a3;
        border-radius:10px;
        padding:36px;
        text-align:center;
      ">

        <!-- LOGO -->
        <tr>
          <td style="padding-bottom:18px;">
            <img
              src="https://raw.githubusercontent.com/kubosis/pwndepot/devel/assets/pwndepot_standard.png"
              onerror="this.onerror=null;this.src='cid:{logo_cid}'"
              width="110"
              alt="PwnDepot"
              style="display:block;margin:0 auto;"
            />
          </td>
        </tr>

        <!-- TITLE -->
        <tr>
          <td>
            <h2 style="
              margin:12px 0;
              color:#eafff6;
              font-size:22px;
            ">
              VERIFY YOUR EMAIL
            </h2>

            <p style="
              color:#9de7c7;
              font-size:14px;
              line-height:1.6;
            ">
              Authorization required.<br/>
              Confirm email to activate account.
            </p>
          </td>
        </tr>

        <!-- BUTTON -->
        <tr>
          <td style="padding:28px 0;">
            <a href="{verify_url}" style="
              display:inline-block;
              padding:14px 40px;
              color:#eafff6;
              background:#0f3d2e;
              text-decoration:none;
              font-weight:bold;
              border-radius:6px;
              border:1px solid #2dd4a3;
            ">
              VERIFY EMAIL
            </a>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td>
            <p style="color:#6fd6a3;font-size:12px;">
              Link expires in 24 hours
            </p>
            <p style="color:#5fbf92;font-size:11px;">
              If you did not initiate this request, ignore this message.
            </p>
          </td>
        </tr>

      </table>

      <p style="margin-top:16px;font-size:10px;color:#4caf85;">
        © 2025 PwnDepot :: Secure Node
      </p>

    </td>
  </tr>
</table>

</body>
</html>
"""


def reset_password_email_html(reset_url: str, logo_cid: str) -> str:
    return f"""
<!DOCTYPE html>
<html>
<body style="background:#ffffff;font-family:Consolas, monospace;">
<table width="100%">
<tr><td align="center" style="padding:48px">

<table width="600" style="
  background:#0a0f0c;
  border:1px solid #f87171;
  border-radius:10px;
  padding:36px;
  text-align:center
">

<tr>
<td style="padding-bottom:18px;">
  <img
    src="https://raw.githubusercontent.com/kubosis/pwndepot/devel/assets/pwndepot_standard.png"
    onerror="this.onerror=null;this.src='cid:{logo_cid}'"
    width="110"
    alt="PwnDepot"
    style="display:block;margin:0 auto;"
  />
</td>
</tr>

<tr>
<td>
<h2 style="color:#ffecec">RESET PASSWORD</h2>
<p style="color:#fca5a5">
A password reset was requested for your account.
</p>
</td>
</tr>

<tr>
<td style="padding:28px">
<a href="{reset_url}" style="
padding:14px 40px;
background:#3f1d1d;
border:1px solid #f87171;
color:#ffecec;
text-decoration:none;
border-radius:6px;
font-weight:bold;
">
RESET PASSWORD
</a>
</td>
</tr>

<tr>
<td>
<p style="color:#fca5a5;font-size:12px">
Link expires in 1 hour
</p>
</td>
</tr>

</table>

</td></tr>
</table>
</body>
</html>
"""
