import nodemailer from 'nodemailer';
import { config } from '../app/env';

// Konfigurasi transporter nodemailer
const transporter = nodemailer.createTransport({
  host: config.mail.host,
  port: config.mail.port,
  secure: config.mail.secure,
  auth: {
    user: config.mail.user,
    pass: config.mail.password,
  },
});

// Fungsi untuk mengirim email verifikasi reset password
export const sendPasswordResetEmail = async (
  email: string,
  token: string,
  name?: string
): Promise<boolean> => {
  try {
    const resetUrl = `${config.frontendUrl}/auth/reset-password/${encodeURIComponent(token)}`;
    // Gunakan nama jika tersedia, jika tidak gunakan "Pengguna"
    const userName = name || "Pengguna";
    const currentYear = new Date().getFullYear();

    const mailOptions = {
      from: `"Sport Center" <${config.mail.user}>`,
      to: email,
      subject: 'Reset Password Sport Center',
      html: `
        <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
        <html xmlns="http://www.w3.org/1999/xhtml">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
          <title>Reset Password</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse;">
                  <!-- HEADER -->
                  <tr>
                    <td bgcolor="#111111" style="padding: 30px 30px 30px 30px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="color: #ffffff; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif; text-align: center;">
                            SPORT CENTER
                          </td>
                        </tr>
                        <tr>
                          <td style="color: #cccccc; font-size: 16px; font-family: Arial, sans-serif; text-align: center; padding: 10px 0 0 0;">
                            Reservasi Lapangan Jadi Lebih Mudah
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- CONTENT -->
                  <tr>
                    <td bgcolor="#ffffff" style="padding: 30px 30px 30px 30px; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="color: #111111; font-size: 22px; font-weight: bold; font-family: Arial, sans-serif; padding-bottom: 15px; border-bottom: 1px solid #e0e0e0;">
                            Reset Password
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 20px 0 0 0; color: #333333; font-size: 16px; font-family: Arial, sans-serif;">
                            Halo, <strong>${userName}</strong>,
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 20px 0 0 0; color: #333333; font-size: 16px; font-family: Arial, sans-serif;">
                            Anda menerima email ini karena kami menerima permintaan reset password untuk akun Sport Center Anda.
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 20px 0 20px 0; color: #333333; font-size: 16px; font-family: Arial, sans-serif;">
                            Silakan klik tombol di bawah ini untuk melanjutkan proses reset password:
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 20px 0; text-align: center;">
                            <table border="0" cellpadding="0" cellspacing="0" align="center">
                              <tr>
                                <td bgcolor="#111111" style="padding: 12px 25px; text-align: center;">
                                  <a href="${resetUrl}" style="display: inline-block; color: #ffffff; font-size: 16px; font-family: Arial, sans-serif; font-weight: bold; text-decoration: none;">Reset Password</a>
                                </td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 20px 0 0 0; color: #333333; font-size: 16px; font-family: Arial, sans-serif;">
                            Jika Anda tidak meminta reset password, abaikan email ini dan tidak ada perubahan yang akan dibuat pada akun Anda.
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 20px 0 0 0; color: #333333; font-size: 16px; font-family: Arial, sans-serif;">
                            Link akan kedaluwarsa dalam waktu <strong>1 jam</strong>.
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 40px 0 0 0; border-top: 1px solid #e0e0e0; color: #555555; font-size: 14px; font-family: Arial, sans-serif;">
                            <p style="margin: 5px 0;">Salam hangat,</p>
                            <p style="margin: 5px 0; font-weight: bold; color: #111111;">Tim Sport Center</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  <!-- FOOTER -->
                  <tr>
                    <td bgcolor="#f8f8f8" style="padding: 20px 30px; text-align: center;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td style="color: #666666; font-family: Arial, sans-serif; font-size: 13px; text-align: center;">
                            &copy; ${currentYear} Sport Center. Semua hak dilindungi.
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0 0 0; color: #666666; font-family: Arial, sans-serif; font-size: 13px; text-align: center;">
                            Jika Anda memiliki pertanyaan, silakan hubungi tim dukungan kami.
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}; 