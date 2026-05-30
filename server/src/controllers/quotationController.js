const PDFDocument = require('pdfkit');
const Quotation = require('../models/Quotation');
const Lead = require('../models/Lead');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { buildLeadAccessQuery, canAccessLead } = require('../middleware/rbac');
const { ROLES } = require('../constants/roles');

const MANAGEMENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEADER];

const defaultBenefits = [
  'Premium UI/UX crafted to deliver a modern brand experience.',
  'Smart lead-to-deal workflow with quotation history and downloadable PDFs.',
  'Secure CRM flow with role-based access, profile verification, and notifications.',
  'Scalable platform structure for sales target tracking and performance analytics.'
];

const defaultTechStack = [
  { category: 'Frontend Web', technologies: 'React.js, Tailwind CSS' },
  { category: 'Backend', technologies: 'Node.js, Express.js' },
  { category: 'Database', technologies: 'MongoDB' },
  { category: 'Authentication & Security', technologies: 'JWT, RBAC, SSL-ready deployment' },
  { category: 'Cloud & Hosting', technologies: 'AWS / Google Cloud / VPS' }
];

const defaultTerms = [
  'This commercial proposal is valid for 48 hours due to current development scheduling.',
  'Project slot, pricing, and delivery commitment will be secured upon advance payment confirmation.',
  'Payment Schedule: 40% advance, 40% milestone payment, and 20% final payment upon completion.',
  'Ownership of deliverables shall transfer to the client only upon receipt of final payment.',
  'Any additional features or modifications beyond agreed scope will incur extra charges.',
  'Delivery timelines are estimated and subject to change based on project complexity and client communication.',
  'All payments to be made via Bank Transfer / UPI to Queneva IT Services Pvt. Ltd.'
];

const number = value => Math.max(0, Number(value || 0));
const money = value => `Rs. ${number(value).toLocaleString('en-IN')}`;
const dateString = value => (value ? new Date(value).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'));

const parseArray = value => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const generateQuotationNo = async () => {
  const year = new Date().getFullYear();
  const count = await Quotation.countDocuments({ createdAt: { $gte: new Date(year, 0, 1) } });
  return `QNV-${String(count + 1).padStart(4, '0')}-${year}`;
};

const normalizePayload = body => {
  const items = parseArray(body.items)
    .map(item => ({ feature: item.feature || item.name, amount: number(item.amount) }))
    .filter(item => item.feature && item.amount >= 0);

  if (!items.length) {
    throw new ApiError(400, 'At least one quotation item is required');
  }

  return {
    customerId: body.customerId || undefined,
    customerName: body.customerName,
    businessName: body.businessName,
    projectType: body.projectType || 'Custom Software Development',
    subscriptionModel: body.subscriptionModel || 'NA',
    items,
    discountPercentage: number(body.discountPercentage),
    taxesText: body.taxesText || 'Not Applicable',
    validUntil: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    softwareBenefits: parseArray(body.softwareBenefits).length ? parseArray(body.softwareBenefits) : defaultBenefits,
    technologyStack: parseArray(body.technologyStack).length ? parseArray(body.technologyStack) : defaultTechStack,
    terms: parseArray(body.terms).length ? parseArray(body.terms) : defaultTerms,
    status: body.status || 'generated'
  };
};

const assertManagerAndLeadAccess = async (user, leadId) => {
  if (!MANAGEMENT_ROLES.includes(user.role)) {
    throw new ApiError(403, 'Only Team Leader, HR, Admin, or Super Admin can manage quotations');
  }

  if (!(await canAccessLead(user, leadId))) {
    throw new ApiError(403, 'Access denied');
  }

  const lead = await Lead.findById(leadId);
  if (!lead || lead.isDeleted) throw new ApiError(404, 'Lead not found');

  if (lead.pipelineStatus !== 'Won') {
    throw new ApiError(400, 'Quotation can be generated only for Won pipeline leads');
  }

  if (lead.finalizationStatus !== 'finalized') {
    throw new ApiError(400, 'Finalize the deal amount before generating quotation');
  }

  return lead;
};

const list = asyncHandler(async (req, res) => {
  const access = await buildLeadAccessQuery(req.user);
  const leads = await Lead.find(access).select('_id').lean();
  const leadIds = leads.map(lead => lead._id);

  const quotations = await Quotation.find({ lead: { $in: leadIds } })
    .populate('lead', 'leadId name companyName pipelineStatus finalizationStatus finalizedAmount')
    .populate('createdBy', 'name email employeeId role')
    .sort({ createdAt: -1 });

  res.json({ success: true, quotations });
});

const create = asyncHandler(async (req, res) => {
  const lead = await assertManagerAndLeadAccess(req.user, req.body.lead);
  const payload = normalizePayload({
    ...req.body,
    customerName: req.body.customerName || lead.name,
    businessName: req.body.businessName || lead.companyName
  });

  const quotation = await Quotation.create({
    ...payload,
    quotationNo: await generateQuotationNo(),
    lead: lead._id,
    createdBy: req.user._id,
    updatedBy: req.user._id
  });

  if (!lead.quotations.map(String).includes(String(quotation._id))) {
    lead.quotations.push(quotation._id);
    lead.activityTimeline.push({
      action: 'Quotation generated',
      description: `${quotation.quotationNo} generated with total ${money(quotation.totalAmount)}`,
      by: req.user._id,
      metadata: { quotationId: quotation._id }
    });
    await lead.save();
  }

  res.status(201).json({ success: true, quotation });
});

const update = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id);
  if (!quotation) throw new ApiError(404, 'Quotation not found');

  await assertManagerAndLeadAccess(req.user, quotation.lead);
  Object.assign(quotation, normalizePayload(req.body));
  quotation.updatedBy = req.user._id;
  await quotation.save();

  res.json({ success: true, quotation });
});

const getById = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id)
    .populate('lead', 'leadId name companyName pipelineStatus finalizationStatus finalizedAmount')
    .populate('createdBy', 'name email employeeId role');

  if (!quotation) throw new ApiError(404, 'Quotation not found');
  if (!(await canAccessLead(req.user, quotation.lead._id))) throw new ApiError(403, 'Access denied');

  res.json({ success: true, quotation });
});

const writeKV = (doc, label, value, x, y, w = 230) => {
  doc.font('Helvetica-Bold').text(label, x, y, { continued: true, width: w });
  doc.font('Helvetica').text(` ${value || 'NA'}`);
};

const renderQuotationPdf = (quotation, res) => {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${quotation.quotationNo}.pdf"`);
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(18).text('Queneva IT Services Pvt. Ltd.', { underline: true });
  doc.font('Helvetica-Oblique').fontSize(10).text('We Make Tech Easy');
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9).text('Address: Space No. A, Ground Floor, Chinar Park, Kolkata, West Bengal 700157');
  doc.text('Corporate Identity Number (CIN): U62013WB2025PTC283119');
  doc.text('Email: info@queneva.com | Phone: +91-8293455159 | Website: www.queneva.com');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(16).fillColor('#1d4ed8').text('QUOTATION', { align: 'center', underline: true });
  doc.fillColor('black').moveDown(0.8);

  const topY = doc.y;
  writeKV(doc, 'Quotation No.:', quotation.quotationNo, 36, topY);
  writeKV(doc, 'Date:', dateString(quotation.createdAt), 245, topY);
  writeKV(doc, 'Valid Until:', dateString(quotation.validUntil), 410, topY);
  doc.moveDown(1.5);

  doc.font('Helvetica-Bold').fontSize(11).text('CUSTOMER DETAILS');
  const boxY = doc.y + 6;
  doc.rect(36, boxY, 523, 54).stroke();
  doc.fontSize(9);
  doc.text('Customer ID', 52, boxY + 10, { width: 140, align: 'center' });
  doc.text('Customer Name', 220, boxY + 10, { width: 140, align: 'center' });
  doc.text('Business Name', 390, boxY + 10, { width: 140, align: 'center' });
  doc.font('Helvetica').text(quotation.customerId || 'NA', 52, boxY + 30, { width: 140, align: 'center' });
  doc.text(quotation.customerName || 'NA', 220, boxY + 30, { width: 140, align: 'center' });
  doc.text(quotation.businessName || 'NA', 390, boxY + 30, { width: 140, align: 'center' });
  doc.y = boxY + 70;

  doc.font('Helvetica-Bold').fontSize(11).text('PROJECT DETAILS & DESCRIPTION OF SERVICES');
  doc.moveDown(0.4);
  writeKV(doc, 'Project Type:', quotation.projectType, 56, doc.y);
  writeKV(doc, 'Subscription Model:', quotation.subscriptionModel, 56, doc.y + 16);
  doc.moveDown(2);

  const tableX = 50;
  let y = doc.y + 8;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.rect(tableX, y, 495, 20).stroke();
  doc.text('Sl. No.', tableX + 6, y + 6, { width: 50 });
  doc.text('Features', tableX + 80, y + 6, { width: 300, align: 'center' });
  doc.text('Amount', tableX + 405, y + 6, { width: 75, align: 'right' });
  y += 20;

  quotation.items.forEach((item, index) => {
    if (y > 710) {
      doc.addPage();
      y = 40;
    }
    doc.rect(tableX, y, 495, 20).stroke();
    doc.font('Helvetica-Bold').text(String(index + 1).padStart(2, '0') + '.', tableX + 10, y + 6, { width: 40 });
    doc.text(item.feature, tableX + 62, y + 6, { width: 330, align: 'center' });
    doc.text(money(item.amount), tableX + 405, y + 6, { width: 75, align: 'right' });
    y += 20;
  });

  doc.y = y + 14;
  doc.font('Helvetica-Bold').fontSize(10).text(`Subtotal: ${money(quotation.subtotal)}`);
  doc.text(`Discount: ${quotation.discountPercentage || 0}%`);
  doc.text(`Taxes: ${quotation.taxesText || 'Not Applicable'}`);
  doc.fontSize(12).text(`Total Amount Payable: ${money(quotation.totalAmount)}`);

  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(14).text(`Software Features & Benefits: ${quotation.businessName || quotation.customerName || ''}`, { underline: true });
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(10);
  (quotation.softwareBenefits || defaultBenefits).forEach(point => {
    doc.text(`• ${point}`, { paragraphGap: 8 });
  });

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(14).text('Technology & Architecture Details:', { underline: true });
  doc.moveDown(0.5);
  (quotation.technologyStack || defaultTechStack).forEach(row => {
    doc.font('Helvetica-Bold').fontSize(10).text(`${row.category}:`, { continued: true, width: 180 });
    doc.font('Helvetica').text(` ${row.technologies || ''}`);
  });

  doc.addPage();
  doc.font('Helvetica-Bold').fontSize(14).text('TERMS & CONDITIONS');
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(10);
  (quotation.terms || defaultTerms).forEach(term => doc.text(`• ${term}`, { paragraphGap: 6 }));
  doc.moveDown(1);
  doc.font('Helvetica-Bold').text('BANK DETAILS');
  doc.font('Helvetica').text(`Bank Name: ${quotation.bankDetails?.bankName || 'Axis Bank'}`);
  doc.text(`Account Name: ${quotation.bankDetails?.accountName || 'Queneva IT Services Pvt. Ltd.'}`);
  doc.text(`Account No: ${quotation.bankDetails?.accountNo || '925020055281414'}`);
  doc.text(`IFSC Code: ${quotation.bankDetails?.ifscCode || 'UTIB0000498'}`);
  doc.moveDown(3);
  doc.font('Helvetica-Bold').text('AUTHORIZED SIGNATORY');
  doc.font('Helvetica').text('For Queneva IT Services Pvt. Ltd.');
  doc.text('(We Make Tech Easy)');
  doc.moveDown(2);
  doc.text('Signature: ____________________');
  doc.text('Name: SUBHADEEP MONDAL');
  doc.text('Designation: BUSINESS DEVELOPMENT MANAGER');
  doc.text(`Date: ${dateString(new Date())}`);

  doc.end();
};

const download = asyncHandler(async (req, res) => {
  const quotation = await Quotation.findById(req.params.id).populate('lead');
  if (!quotation) throw new ApiError(404, 'Quotation not found');
  if (!(await canAccessLead(req.user, quotation.lead._id))) throw new ApiError(403, 'Access denied');
  renderQuotationPdf(quotation, res);
});

module.exports = {
  list,
  create,
  update,
  getById,
  download
};
