const nodemailer = require('nodemailer');
const env = require('../config/env');

const createTransport = () => {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) return null;
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass }
  });
};

const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = createTransport();
  if (!transporter) {
    console.log('[Email disabled]', { to, subject, text: text || html });
    return { skipped: true };
  }
  return transporter.sendMail({ from: env.smtp.from, to, subject, html, text });
};

const sendCredentialsEmail = async ({ to, password, role }) => sendEmail({
  to,
  subject: 'Your CRM login credentials',
  html: `<p>Your ${role} account has been created.</p><p>Email: <strong>${to}</strong></p><p>Default password: <strong>${password}</strong></p><p>Please change your password after first login.</p>`,
  text: `Your ${role} account has been created. Email: ${to}. Default password: ${password}. Change it after first login.`
});

module.exports = { sendEmail, sendCredentialsEmail };
