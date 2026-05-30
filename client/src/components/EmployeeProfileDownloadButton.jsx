import { Download } from 'lucide-react';

const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
const assetUrl = url => (url?.startsWith('/uploads') ? `${API_ORIGIN}${url}` : url);

const escapeHtml = value =>
  String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const formatDate = value => (value ? new Date(value).toLocaleDateString() : '—');
const formatDateTime = value => (value ? new Date(value).toLocaleString() : '—');
const safeFileName = value =>
  String(value || 'employee-profile')
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'employee-profile';

const formatDuration = ms => {
  const totalMinutes = Math.max(0, Math.round((Number(ms) || 0) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
};

const detailRow = (label, value) => `
  <tr>
    <th>${escapeHtml(label)}</th>
    <td>${escapeHtml(value)}</td>
  </tr>`;

const documentLink = (label, url) => {
  if (!url) return '';
  const href = assetUrl(url);

  return `
    <li>
      <strong>${escapeHtml(label)}:</strong>
      <a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">Open / Download</a>
    </li>`;
};

const buildProfileHtml = ({ profile, activity = {} }) => {
  const parentName =
    profile.assignedTeamLeader?.name ||
    profile.assignedHR?.name ||
    (profile.role === 'ADMIN' ? '—' : 'Admin');

  const baseRows = [
    ['Name', profile.name || 'Profile pending'],
    ['Email', profile.email],
    ['Employee ID', profile.employeeId],
    ['HR ID', profile.hrUniqueId],
    ['Team Leader ID', profile.teamLeaderUniqueId],
    ['Role', profile.role],
    ['Login Access', profile.isActive === false ? 'Deactivated' : 'Active'],
    ['Verification Status', profile.verificationStatus || (profile.isVerified ? 'verified' : 'pending_review')],
    ['Profile Completion', `${profile.profileCompletionPercentage || 0}%`],
    ['Pending Required Fields', profile.pendingRequiredFields?.length ? profile.pendingRequiredFields.join(', ') : 'None'],
    ['Verification Notes', profile.verificationNotes || '—'],
    ['Parent', parentName],
    ['Phone', profile.phone],
    ['Address', profile.address],
    ['Shift', `${profile.shiftStart || '09:00'} - ${profile.shiftEnd || '19:00'}`],
    ['Joining Date', formatDate(profile.joiningDate)],
    ['Date of Birth', formatDate(profile.dateOfBirth)],
    ['Gender', profile.gender],
    ['Emergency Contact', profile.emergencyContactNumber],
    ['Previous Company', profile.previousCompanyName],
    ['PAN', profile.panCard],
    ['Bank Account Holder', profile.bankDetails?.accountHolderName],
    ['Bank Name', profile.bankDetails?.bankName],
    ['Bank Account Number', profile.bankDetails?.accountNumber],
    ['Bank IFSC', profile.bankDetails?.ifsc],
    ['Online Status', profile.onlineStatus || 'offline'],
    ['Current Activity', profile.currentActivityState || 'Offline'],
    ['Last Seen', formatDateTime(profile.lastSeen)],
    ['Last Profile Submitted', formatDateTime(profile.lastProfileSubmittedAt)],
    ['Verified At', formatDateTime(profile.verifiedAt)],
    ['Created At', formatDateTime(profile.createdAt)],
    ['Updated At', formatDateTime(profile.updatedAt)]
  ];

  const standardDocuments = [
    documentLink('Profile Photo', profile.profilePhoto),
    documentLink('Aadhaar Card', profile.aadhaarCard),
    documentLink('Previous Company Payslip', profile.previousCompanyPayslip),
    documentLink('Experience Letter', profile.experienceLetter)
  ].filter(Boolean);

  const otherDocuments = (profile.documents || [])
    .map(
      document => `
        <tr>
          <td>${escapeHtml(document.documentName || document.label || 'Document')}</td>
          <td>${escapeHtml(document.status || 'pending_review')}</td>
          <td>${escapeHtml(formatDateTime(document.uploadedAt))}</td>
          <td>${document.url ? `<a href="${escapeHtml(assetUrl(document.url))}" target="_blank" rel="noreferrer">Open / Download</a>` : '—'}</td>
          <td>${escapeHtml(document.originalName || document.mimeType || '—')}</td>
          <td>${escapeHtml(document.reviewNote || '—')}</td>
        </tr>`
    )
    .join('');

  const attendanceRows = (activity.attendance || [])
    .slice(0, 30)
    .map(
      item => `
        <tr>
          <td>${escapeHtml(formatDate(item.date))}</td>
          <td>${escapeHtml(formatDateTime(item.loginTime))}</td>
          <td>${escapeHtml(formatDateTime(item.logoutTime))}</td>
          <td>${escapeHtml(formatDuration(item.activeTimeInsideShift))}</td>
          <td>${escapeHtml(formatDuration(item.idleTimeInsideShift))}</td>
          <td>${escapeHtml(formatDuration(item.offlineTimeInsideShift))}</td>
        </tr>`
    )
    .join('');

  const leadRows = (activity.leads || [])
    .slice(0, 30)
    .map(
      lead => `
        <tr>
          <td>${escapeHtml(lead.name)}</td>
          <td>${escapeHtml(lead.companyName || '—')}</td>
          <td>${escapeHtml(lead.leadType || '—')}</td>
          <td>${escapeHtml(lead.pipelineStatus || '—')}</td>
          <td>${escapeHtml(lead.finalizationStatus || 'not_requested')}</td>
          <td>₹${escapeHtml(Number(lead.finalizedAmount || 0).toLocaleString('en-IN'))}</td>
        </tr>`
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(profile.name || profile.email || 'Employee Profile')}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; line-height: 1.45; }
    h1, h2 { margin: 0 0 12px; }
    h1 { color: #1d4ed8; }
    section { margin-top: 28px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #dbe3ef; padding: 9px 10px; text-align: left; vertical-align: top; }
    th { width: 260px; background: #f8fafc; }
    a { color: #2563eb; font-weight: 600; }
    .muted { color: #64748b; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 700; }
    ul { padding-left: 20px; }
    @media print { body { margin: 16px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <button class="no-print" onclick="window.print()" style="float:right;padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;font-weight:700;cursor:pointer;">Print / Save as PDF</button>
  <h1>${escapeHtml(profile.name || 'Employee Profile')}</h1>
  <p class="muted">${escapeHtml(profile.email || '—')} · ${escapeHtml(profile.employeeId || '—')}</p>
  <p><span class="badge">${escapeHtml(profile.verificationStatus || 'pending_review')}</span></p>

  <section>
    <h2>Profile Details</h2>
    <table><tbody>${baseRows.map(([label, value]) => detailRow(label, value)).join('')}</tbody></table>
  </section>

  <section>
    <h2>Documents</h2>
    ${standardDocuments.length ? `<ul>${standardDocuments.join('')}</ul>` : '<p class="muted">No standard documents uploaded.</p>'}
    <table>
      <thead><tr><th>Document Name</th><th>Status</th><th>Uploaded</th><th>File</th><th>Original File</th><th>Review Note</th></tr></thead>
      <tbody>${otherDocuments || '<tr><td colspan="6">No extra documents uploaded.</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Recent Attendance</h2>
    <table>
      <thead><tr><th>Date</th><th>Login</th><th>Logout</th><th>Active</th><th>Idle</th><th>Offline</th></tr></thead>
      <tbody>${attendanceRows || '<tr><td colspan="6">No attendance rows found.</td></tr>'}</tbody>
    </table>
  </section>

  <section>
    <h2>Recent Leads</h2>
    <table>
      <thead><tr><th>Lead</th><th>Company</th><th>Type</th><th>Pipeline</th><th>Deal</th><th>Final Amount</th></tr></thead>
      <tbody>${leadRows || '<tr><td colspan="6">No lead rows found.</td></tr>'}</tbody>
    </table>
  </section>

  <p class="muted" style="margin-top:32px;">Downloaded on ${escapeHtml(formatDateTime(new Date()))}</p>
</body>
</html>`;
};

export default function EmployeeProfileDownloadButton({ profile, activity, className = 'btn-primary flex items-center justify-center gap-2' }) {
  const downloadProfile = () => {
    if (!profile) return;

    const html = buildProfileHtml({ profile, activity });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${safeFileName(profile.employeeId || profile.name || profile.email)}-profile.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <button type="button" onClick={downloadProfile} disabled={!profile} className={className}>
      <Download size={16} />
      Download Profile
    </button>
  );
}
