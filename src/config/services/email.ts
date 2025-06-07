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
  token: string
): Promise<boolean> => {
  try {
    const resetUrl = `${config.frontendUrl}/auth/reset-password?token=${token}`;

    const mailOptions = {
      from: `"Sport Center" <${config.mail.user}>`,
      to: email,
      subject: 'Reset Password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
          <h2 style="color: #333;">Reset Password</h2>
          <p>Anda menerima email ini karena Anda (atau seseorang) telah meminta reset password untuk akun Anda.</p>
          <p>Silakan klik tautan di bawah ini untuk melanjutkan proses reset password:</p>
          <p><a href="${resetUrl}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 3px; display: inline-block; margin: 10px 0;">Reset Password</a></p>
          <p>Jika Anda tidak meminta reset password, Anda dapat mengabaikan email ini dan tidak ada perubahan yang akan dibuat pada akun Anda.</p>
          <p>Link akan kedaluwarsa dalam waktu 1 jam.</p>
          <p>Terima kasih!</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}; 