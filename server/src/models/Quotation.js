const mongoose = require('mongoose');

const QuotationItemSchema = new mongoose.Schema(
  {
    feature: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 }
  },
  { _id: true }
);

const QuotationSchema = new mongoose.Schema(
  {
    quotationNo: { type: String, unique: true, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    customerId: { type: String, trim: true },
    customerName: { type: String, required: true, trim: true },
    businessName: { type: String, trim: true },
    projectType: { type: String, default: 'Custom Software Development', trim: true },
    subscriptionModel: { type: String, default: 'NA', trim: true },
    items: [QuotationItemSchema],
    subtotal: { type: Number, default: 0, min: 0 },
    discountPercentage: { type: Number, default: 0, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxesText: { type: String, default: 'Not Applicable', trim: true },
    totalAmount: { type: Number, default: 0, min: 0 },
    validUntil: Date,
    softwareBenefits: [{ type: String, trim: true }],
    technologyStack: [{ category: String, technologies: String }],
    terms: [{ type: String, trim: true }],
    bankDetails: {
      bankName: { type: String, default: 'Axis Bank' },
      accountName: { type: String, default: 'Queneva IT Services Pvt. Ltd.' },
      accountNo: { type: String, default: '925020055281414' },
      ifscCode: { type: String, default: 'UTIB0000498' }
    },
    status: { type: String, enum: ['draft', 'generated', 'sent', 'accepted', 'rejected'], default: 'generated' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

QuotationSchema.pre('validate', function calculateTotals(next) {
  this.subtotal = (this.items || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  this.discountAmount = Math.round((this.subtotal * Number(this.discountPercentage || 0)) / 100);
  this.totalAmount = Math.max(0, this.subtotal - this.discountAmount);
  next();
});

module.exports = mongoose.model('Quotation', QuotationSchema);
