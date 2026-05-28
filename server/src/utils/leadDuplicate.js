const normalize = value => String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
const digits = value => String(value || '').replace(/\D/g, '');

const buildDuplicateQuery = lead => {
  const clauses = [];
  if (digits(lead.contactNumber).length >= 7) clauses.push({ contactNumberNormalized: digits(lead.contactNumber) });
  if (normalize(lead.email)) clauses.push({ emailNormalized: normalize(lead.email) });
  if (normalize(lead.website)) clauses.push({ websiteNormalized: normalize(lead.website) });
  if (normalize(lead.companyName)) clauses.push({ companyNameNormalized: normalize(lead.companyName) });
  return clauses.length ? { $or: clauses, isDeleted: false } : null;
};

const hydrateLeadNormalizers = lead => {
  lead.contactNumberNormalized = digits(lead.contactNumber);
  lead.emailNormalized = normalize(lead.email);
  lead.websiteNormalized = normalize(lead.website);
  lead.companyNameNormalized = normalize(lead.companyName);
  lead.nameNormalized = normalize(lead.name);
  return lead;
};

module.exports = { normalize, digits, buildDuplicateQuery, hydrateLeadNormalizers };
