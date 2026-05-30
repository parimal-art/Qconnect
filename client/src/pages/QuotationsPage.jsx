import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';

import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { LoadingState } from '../components/LoadingState';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const date = value => (value ? new Date(value).toLocaleDateString() : '—');

const defaultItem = () => ({ feature: '', amount: '' });

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    lead: '',
    customerName: '',
    businessName: '',
    customerId: '',
    projectType: 'Custom Software Development',
    subscriptionModel: 'NA',
    discountPercentage: 0,
    taxesText: 'Not Applicable',
    validUntil: '',
    items: [defaultItem()]
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [quotationResponse, leadResponse] = await Promise.all([
        api.get('/quotations'),
        api.get('/leads?limit=100&pipelineStatus=Won')
      ]);
      setQuotations(quotationResponse.data.quotations || []);
      setLeads(leadResponse.data.leads || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load quotations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const wonLeads = useMemo(() => leads.filter(lead => lead.pipelineStatus === 'Won' && lead.finalizationStatus === 'finalized'), [leads]);

  const updateItem = (index, key, value) => {
    setForm(current => ({
      ...current,
      items: current.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    }));
  };

  const selectLead = leadId => {
    const selected = leads.find(lead => lead._id === leadId);
    setForm(current => ({
      ...current,
      lead: leadId,
      customerName: selected?.name || current.customerName,
      businessName: selected?.companyName || current.businessName,
      items:
        selected?.finalizedAmount > 0
          ? [{ feature: selected.additionalInfo || selected.domain || 'Software development services', amount: selected.finalizedAmount }]
          : current.items
    }));
  };

  const downloadQuotation = async quotation => {
    try {
      const { data } = await api.get(`/quotations/${quotation._id}/download`, { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${quotation.quotationNo || 'quotation'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setError(err.response?.data?.message || 'Quotation download failed.');
    }
  };

  const createQuotation = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!form.lead || !form.customerName || !form.items.some(item => item.feature && Number(item.amount) >= 0)) {
      setError('Select a Won lead, customer name, and at least one valid quotation item.');
      return;
    }

    try {
      await api.post('/quotations', {
        ...form,
        items: form.items.filter(item => item.feature).map(item => ({ ...item, amount: Number(item.amount || 0) }))
      });
      setMessage('Quotation generated and saved.');
      setForm({
        lead: '',
        customerName: '',
        businessName: '',
        customerId: '',
        projectType: 'Custom Software Development',
        subscriptionModel: 'NA',
        discountPercentage: 0,
        taxesText: 'Not Applicable',
        validUntil: '',
        items: [defaultItem()]
      });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Quotation create failed.');
    }
  };

  const columns = [
    { key: 'quotationNo', header: 'Quotation No.' },
    {
      key: 'customer',
      header: 'Customer',
      render: quotation => (
        <div>
          <p className="font-semibold">{quotation.customerName}</p>
          <p className="text-xs text-slate-500">{quotation.businessName || quotation.lead?.companyName || '—'}</p>
        </div>
      )
    },
    { key: 'lead', header: 'Lead', render: quotation => quotation.lead?.name || '—' },
    { key: 'totalAmount', header: 'Total', render: quotation => money(quotation.totalAmount) },
    { key: 'status', header: 'Status', render: quotation => <StatusBadge value={quotation.status} /> },
    { key: 'validUntil', header: 'Valid Until', render: quotation => date(quotation.validUntil) },
    {
      key: 'download',
      header: 'Download',
      render: quotation => (
        <button type="button" onClick={() => downloadQuotation(quotation)} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
          <Download size={15} /> PDF
        </button>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Quotations</h1>
        <p className="text-slate-500">Generate, save, view and download quotations for Won leads after deal finalization.</p>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">{message}</div>}

      <form onSubmit={createQuotation} className="card space-y-4">
        <h2 className="text-xl font-bold">Generate quotation</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <select className="input" value={form.lead} onChange={event => selectLead(event.target.value)}>
            <option value="">Select Won lead</option>
            {wonLeads.map(lead => (
              <option key={lead._id} value={lead._id}>{lead.name} · {lead.companyName || 'No company'} · {money(lead.finalizedAmount)}</option>
            ))}
          </select>
          <input className="input" value={form.customerId} onChange={event => setForm(current => ({ ...current, customerId: event.target.value }))} placeholder="Customer ID" />
          <input className="input" value={form.customerName} onChange={event => setForm(current => ({ ...current, customerName: event.target.value }))} placeholder="Customer name" />
          <input className="input" value={form.businessName} onChange={event => setForm(current => ({ ...current, businessName: event.target.value }))} placeholder="Business name" />
          <input className="input" value={form.projectType} onChange={event => setForm(current => ({ ...current, projectType: event.target.value }))} placeholder="Project type" />
          <input className="input" value={form.subscriptionModel} onChange={event => setForm(current => ({ ...current, subscriptionModel: event.target.value }))} placeholder="Subscription model" />
          <input className="input" type="number" min="0" value={form.discountPercentage} onChange={event => setForm(current => ({ ...current, discountPercentage: event.target.value }))} placeholder="Discount %" />
          <input className="input" value={form.taxesText} onChange={event => setForm(current => ({ ...current, taxesText: event.target.value }))} placeholder="Taxes text" />
          <input className="input" type="date" value={form.validUntil} onChange={event => setForm(current => ({ ...current, validUntil: event.target.value }))} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Quotation items</h3>
            <button type="button" className="btn-secondary" onClick={() => setForm(current => ({ ...current, items: [...current.items, defaultItem()] }))}>Add item</button>
          </div>
          {form.items.map((item, index) => (
            <div key={index} className="grid gap-3 md:grid-cols-[1fr_180px]">
              <input className="input" value={item.feature} onChange={event => updateItem(index, 'feature', event.target.value)} placeholder="Feature / service" />
              <input className="input" type="number" min="0" value={item.amount} onChange={event => updateItem(index, 'amount', event.target.value)} placeholder="Amount" />
            </div>
          ))}
        </div>

        <button className="btn-primary">Save quotation</button>
      </form>

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Saved quotations</h2>
        {loading ? <LoadingState rows={4} /> : <DataTable columns={columns} rows={quotations} keyField="_id" />}
      </section>
    </div>
  );
}
