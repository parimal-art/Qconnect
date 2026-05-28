const asyncHandler = require('../utils/asyncHandler');
const { dashboardReport, leadsReport, attendanceReport, teamPerformanceReport, breakReport, leaveReport } = require('../services/reportService');
const { toCsv, toExcelBuffer, toPdfBuffer } = require('../utils/exporters');
const ApiError = require('../utils/ApiError');

const dashboard = asyncHandler(async (req, res) => res.json({ success: true, data: await dashboardReport(req.user, req.query) }));
const leads = asyncHandler(async (req, res) => res.json({ success: true, data: await leadsReport(req.user, req.query) }));
const attendance = asyncHandler(async (req, res) => res.json({ success: true, data: await attendanceReport(req.user, req.query) }));
const activeHours = asyncHandler(async (req, res) => res.json({ success: true, data: await attendanceReport(req.user, req.query) }));
const teamPerformance = asyncHandler(async (req, res) => res.json({ success: true, data: await teamPerformanceReport(req.user, req.query) }));
const salespersonPerformance = teamPerformance;

const exportReport = asyncHandler(async (req, res) => {
  const type = req.query.type || req.path.split('/').pop() || 'leads';
  const format = req.query.format || (req.path.includes('/csv') ? 'csv' : req.path.includes('/excel') ? 'excel' : 'pdf');
  let rows;
  if (type === 'attendance' || type === 'active-hours') rows = await attendanceReport(req.user, req.query);
  else if (type === 'team-performance' || type === 'salesperson-performance') rows = await teamPerformanceReport(req.user, req.query);
  else if (type === 'break') rows = await breakReport(req.user, req.query);
  else if (type === 'leave') rows = await leaveReport(req.user, req.query);
  else rows = await leadsReport(req.user, req.query);

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    return res.send(toCsv(rows));
  }
  if (format === 'excel') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.xlsx"`);
    return res.send(toExcelBuffer(rows));
  }
  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
    return res.send(await toPdfBuffer(rows));
  }
  throw new ApiError(400, 'Unsupported export format');
});

module.exports = { dashboard, leads, attendance, activeHours, teamPerformance, salespersonPerformance, exportReport };
