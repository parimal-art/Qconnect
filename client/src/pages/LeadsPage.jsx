import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import api from '../lib/api';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import LeadKanban from '../components/LeadKanban';
import { LoadingState } from '../components/LoadingState';
import { ROLES } from '../lib/roles';

const leadInitial = {
  name: '',
  companyName: '',
  contactNumber: '',
  email: '',
  website: '',
  domain: '',
  address: '',
  source: 'Manual',
  additionalInfo: '',
  leadType: 'Cold Lead',
  pipelineStatus: 'New Lead',
  callStatus: '',
  actionRequired: 'Follow-up',
  remarks: '',
  followUpDate: '',
  assignedTo: ''
};

const leadTypes = ['Hot Lead', 'Mid Lead', 'Cold Lead'];

const pipelineStatuses = [
  'New Lead',
  'Contacted',
  'Interested',
  'Follow-up',
  'Demo Scheduled',
  'Negotiation',
  'Won',
  'Lost'
];

const callStatuses = [
  '',
  'Received',
  'Rejected',
  'Not received',
  'Wrong number',
  'Switched off',
  'Call back later'
];

const actionOptions = [
  'Follow-up',
  'Demo required',
  'Send proposal',
  'No action',
  'Close lead'
];

const toDateTimeLocal = value => {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
};

const normalizeLeadForForm = lead => ({
  name: lead?.name || '',
  companyName: lead?.companyName || '',
  contactNumber: lead?.contactNumber || '',
  email: lead?.email || '',
  website: lead?.website || '',
  domain: lead?.domain || '',
  address: lead?.address || '',
  source: lead?.source || 'Manual',
  additionalInfo: lead?.additionalInfo || '',
  leadType: lead?.leadType || 'Cold Lead',
  pipelineStatus: lead?.pipelineStatus || 'New Lead',
  callStatus: lead?.callStatus || '',
  actionRequired: lead?.actionRequired || 'Follow-up',
  remarks: lead?.remarks || '',
  followUpDate: toDateTimeLocal(lead?.followUpDate),
  assignedTo: lead?.assignedTo?._id || lead?.assignedTo || ''
});

export default function LeadsPage() {
  const { user } = useSelector(state => state.auth);

  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(leadInitial);
  const [editLead, setEditLead] = useState(null);
  const [editForm, setEditForm] = useState(leadInitial);
  const [query, setQuery] = useState('');
  const [view, setView] = useState('table');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isSalesperson = user?.role === ROLES.SALESPERSON;

  const salespersons = useMemo(
    () => employees.filter(employee => employee.role === ROLES.SALESPERSON),
    [employees]
  );

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [leadResponse, userResponse] = await Promise.all([
        api.get('/leads?limit=100'),
        api.get('/users/children').catch(() => ({
          data: { users: [] }
        }))
      ]);

      setLeads(leadResponse.data.leads || []);
      setEmployees(userResponse.data.users || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load leads.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateCreateField = (key, value) => {
    setForm(current => ({
      ...current,
      [key]: value
    }));
  };

  const updateEditField = (key, value) => {
    setEditForm(current => ({
      ...current,
      [key]: value
    }));
  };

  const buildPayload = values => {
    const payload = { ...values };

    Object.keys(payload).forEach(key => {
      if (payload[key] === '') {
        delete payload[key];
      }
    });

    if (payload.followUpDate) {
      payload.followUpDate = new Date(payload.followUpDate);
    }

    if (isSalesperson) {
      delete payload.assignedTo;
    }

    return payload;
  };

  const create = async event => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!form.name.trim()) {
      setError('Lead name is required.');
      return;
    }

    if (!form.contactNumber.trim() && !form.email.trim()) {
      setError('Enter at least contact number or email.');
      return;
    }

    try {
      setSaving(true);

      const payload = buildPayload(form);

      await api.post('/leads', payload);

      setMessage('Lead created successfully.');
      setForm(leadInitial);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lead create failed.');
    } finally {
      setSaving(false);
    }
  };

  const upload = async event => {
    const file = event.target.files?.[0];

    if (!file) return;

    setError('');
    setMessage('');

    try {
      const fd = new FormData();

      fd.append('file', file);

      if (form.assignedTo) {
        fd.append('assignedTo', form.assignedTo);
      }

      await api.post('/leads/upload', fd);

      setMessage('Leads uploaded successfully.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lead upload failed.');
    } finally {
      event.target.value = '';
    }
  };

  const openEdit = lead => {
    setEditLead(lead);
    setEditForm(normalizeLeadForForm(lead));
    setError('');
    setMessage('');
  };

  const closeEdit = () => {
    setEditLead(null);
    setEditForm(leadInitial);
  };

  const saveEdit = async event => {
    event.preventDefault();

    if (!editLead?._id) return;

    setError('');
    setMessage('');

    try {
      setSaving(true);

      await api.put(`/leads/${editLead._id}`, buildPayload(editForm));

      setMessage('Lead updated successfully.');
      closeEdit();
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lead update failed.');
    } finally {
      setSaving(false);
    }
  };

  const saveCallUpdate = async lead => {
    setError('');
    setMessage('');

    try {
      await api.put(`/leads/${lead._id}/status`, {
        leadType: lead.leadType,
        pipelineStatus: lead.pipelineStatus,
        callStatus: lead.callStatus,
        actionRequired: lead.actionRequired,
        remarks: lead.remarks,
        followUpDate: lead.followUpDate
      });

      setMessage('Call details updated successfully.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Call update failed.');
    }
  };

  const complete = async lead => {
    setError('');
    setMessage('');

    try {
      await api.put(`/leads/${lead._id}/complete`, {
        pipelineStatus: lead.pipelineStatus === 'Lost' ? 'Lost' : 'Won',
        callStatus: lead.callStatus || undefined,
        remarks: lead.remarks || undefined
      });

      setMessage('Lead marked as completed.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lead complete failed.');
    }
  };

  const search = async event => {
    const value = event.target.value;

    setQuery(value);

    if (value.trim().length <= 1) {
      await load();
      return;
    }

    try {
      const { data } = await api.get(`/leads/search?q=${encodeURIComponent(value)}`);
      setLeads(data.leads || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Search failed.');
    }
  };

  const updateInlineLead = (leadId, key, value) => {
    setLeads(current =>
      current.map(lead =>
        lead._id === leadId
          ? {
              ...lead,
              [key]: value
            }
          : lead
      )
    );
  };

  const columns = [
    {
      key: 'name',
      header: 'Lead',
      render: lead => (
        <div>
          <p className="font-semibold">{lead.name}</p>
          <p className="text-xs text-slate-500">{lead.companyName || 'No company'}</p>
          {lead.isSelfGenerated && (
            <p className="mt-1 text-xs font-semibold text-emerald-600">
              Self-generated / Reward eligible
            </p>
          )}
        </div>
      )
    },
    {
      key: 'contact',
      header: 'Contact',
      render: lead => (
        <div>
          <p>{lead.contactNumber || '—'}</p>
          <p className="text-xs text-slate-500">{lead.email || '—'}</p>
          <p className="text-xs text-slate-500">{lead.website || '—'}</p>
        </div>
      )
    },
    {
      key: 'leadType',
      header: 'Lead Type',
      render: lead => (
        <select
          className="input min-w-32"
          value={lead.leadType || 'Cold Lead'}
          onChange={event => updateInlineLead(lead._id, 'leadType', event.target.value)}
        >
          {leadTypes.map(type => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'pipelineStatus',
      header: 'Pipeline',
      render: lead => (
        <select
          className="input min-w-40"
          value={lead.pipelineStatus || 'New Lead'}
          onChange={event => updateInlineLead(lead._id, 'pipelineStatus', event.target.value)}
        >
          {pipelineStatuses.map(status => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'callStatus',
      header: 'Call Status',
      render: lead => (
        <select
          className="input min-w-40"
          value={lead.callStatus || ''}
          onChange={event => updateInlineLead(lead._id, 'callStatus', event.target.value)}
        >
          {callStatuses.map(status => (
            <option key={status || 'empty'} value={status}>
              {status || 'Select call status'}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'actionRequired',
      header: 'Action',
      render: lead => (
        <select
          className="input min-w-40"
          value={lead.actionRequired || 'Follow-up'}
          onChange={event => updateInlineLead(lead._id, 'actionRequired', event.target.value)}
        >
          {actionOptions.map(action => (
            <option key={action} value={action}>
              {action}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: lead => (
        <textarea
          className="input min-w-56"
          rows="2"
          value={lead.remarks || ''}
          onChange={event => updateInlineLead(lead._id, 'remarks', event.target.value)}
          placeholder="Call remarks..."
        />
      )
    },
    {
      key: 'followUpDate',
      header: 'Follow-up',
      render: lead => (
        <input
          className="input min-w-48"
          type="datetime-local"
          value={toDateTimeLocal(lead.followUpDate)}
          onChange={event => updateInlineLead(lead._id, 'followUpDate', event.target.value)}
        />
      )
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: lead => lead.assignedTo?.name || 'Self / Unassigned'
    },
    {
      key: 'isCompleted',
      header: 'Completed',
      render: lead => (
        <StatusBadge value={lead.isCompleted ? 'Approved' : 'Pending'} />
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: lead => (
        <div className="flex min-w-44 flex-col gap-2">
          <button
            type="button"
            onClick={() => saveCallUpdate(lead)}
            className="text-left text-sm font-semibold text-blue-600"
          >
            Save Call Update
          </button>

          <button
            type="button"
            onClick={() => openEdit(lead)}
            className="text-left text-sm font-semibold text-slate-700"
          >
            Edit Full Lead
          </button>

          <button
            type="button"
            onClick={() => complete(lead)}
            className="text-left text-sm font-semibold text-emerald-600"
          >
            Complete
          </button>
        </div>
      )
    }
  ];

  if (loading) return <LoadingState rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead management</h1>
          <p className="text-slate-500">
            Create leads, assign leads, update call status, update remarks, and track pipeline.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('table')}
            className="btn-secondary"
          >
            Table
          </button>

          <button
            type="button"
            onClick={() => setView('kanban')}
            className="btn-secondary"
          >
            Kanban
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      <form onSubmit={create} className="card">
        <h2 className="font-semibold">
          {isSalesperson ? 'Add self-generated lead' : 'Create / assign lead'}
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            className="input"
            placeholder="Lead name *"
            value={form.name}
            onChange={event => updateCreateField('name', event.target.value)}
          />

          <input
            className="input"
            placeholder="Company"
            value={form.companyName}
            onChange={event => updateCreateField('companyName', event.target.value)}
          />

          <input
            className="input"
            placeholder="Phone"
            value={form.contactNumber}
            onChange={event => updateCreateField('contactNumber', event.target.value)}
          />

          <input
            className="input"
            placeholder="Email"
            value={form.email}
            onChange={event => updateCreateField('email', event.target.value)}
          />

          <input
            className="input"
            placeholder="Website"
            value={form.website}
            onChange={event => updateCreateField('website', event.target.value)}
          />

          <input
            className="input"
            placeholder="Domain"
            value={form.domain}
            onChange={event => updateCreateField('domain', event.target.value)}
          />

          <input
            className="input"
            placeholder="Source"
            value={form.source}
            onChange={event => updateCreateField('source', event.target.value)}
          />

          <select
            className="input"
            value={form.leadType}
            onChange={event => updateCreateField('leadType', event.target.value)}
          >
            {leadTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={form.pipelineStatus}
            onChange={event => updateCreateField('pipelineStatus', event.target.value)}
          >
            {pipelineStatuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={form.callStatus}
            onChange={event => updateCreateField('callStatus', event.target.value)}
          >
            {callStatuses.map(status => (
              <option key={status || 'empty'} value={status}>
                {status || 'Select call status'}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={form.actionRequired}
            onChange={event => updateCreateField('actionRequired', event.target.value)}
          >
            {actionOptions.map(action => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>

          {!isSalesperson && (
            <select
              className="input"
              value={form.assignedTo}
              onChange={event => updateCreateField('assignedTo', event.target.value)}
            >
              <option value="">Assign salesperson</option>
              {salespersons.map(salesperson => (
                <option key={salesperson._id} value={salesperson._id}>
                  {salesperson.name || salesperson.email}
                </option>
              ))}
            </select>
          )}

          <input
            className="input md:col-span-2"
            placeholder="Address"
            value={form.address}
            onChange={event => updateCreateField('address', event.target.value)}
          />

          <input
            className="input md:col-span-2"
            type="datetime-local"
            value={form.followUpDate}
            onChange={event => updateCreateField('followUpDate', event.target.value)}
          />

          <textarea
            className="input md:col-span-2"
            rows="2"
            placeholder="Additional info"
            value={form.additionalInfo}
            onChange={event => updateCreateField('additionalInfo', event.target.value)}
          />

          <textarea
            className="input md:col-span-2"
            rows="2"
            placeholder="Remarks"
            value={form.remarks}
            onChange={event => updateCreateField('remarks', event.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isSalesperson ? 'Create Self Lead' : 'Create Lead'}
          </button>

          {!isSalesperson && (
            <label className="btn-secondary cursor-pointer">
              Upload CSV/Excel
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={upload}
              />
            </label>
          )}
        </div>
      </form>

      <input
        className="input max-w-md"
        placeholder="Search leads by name, company, phone, email, website..."
        value={query}
        onChange={search}
      />

      {view === 'kanban' ? (
        <LeadKanban leads={leads} onChanged={load} />
      ) : (
        <DataTable columns={columns} rows={leads} keyField="_id" />
      )}

      {editLead && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <form onSubmit={saveEdit} className="card max-h-[90vh] w-full max-w-5xl overflow-y-auto">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold">Edit lead</h2>
                <p className="text-sm text-slate-500">
                  Update lead details, call status, lead type, remarks, and follow-up.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEdit}
                className="btn-secondary"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <input
                className="input"
                placeholder="Lead name *"
                value={editForm.name}
                onChange={event => updateEditField('name', event.target.value)}
              />

              <input
                className="input"
                placeholder="Company"
                value={editForm.companyName}
                onChange={event => updateEditField('companyName', event.target.value)}
              />

              <input
                className="input"
                placeholder="Phone"
                value={editForm.contactNumber}
                onChange={event => updateEditField('contactNumber', event.target.value)}
              />

              <input
                className="input"
                placeholder="Email"
                value={editForm.email}
                onChange={event => updateEditField('email', event.target.value)}
              />

              <input
                className="input"
                placeholder="Website"
                value={editForm.website}
                onChange={event => updateEditField('website', event.target.value)}
              />

              <input
                className="input"
                placeholder="Domain"
                value={editForm.domain}
                onChange={event => updateEditField('domain', event.target.value)}
              />

              <input
                className="input"
                placeholder="Source"
                value={editForm.source}
                onChange={event => updateEditField('source', event.target.value)}
              />

              <select
                className="input"
                value={editForm.leadType}
                onChange={event => updateEditField('leadType', event.target.value)}
              >
                {leadTypes.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              <select
                className="input"
                value={editForm.pipelineStatus}
                onChange={event => updateEditField('pipelineStatus', event.target.value)}
              >
                {pipelineStatuses.map(status => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <select
                className="input"
                value={editForm.callStatus}
                onChange={event => updateEditField('callStatus', event.target.value)}
              >
                {callStatuses.map(status => (
                  <option key={status || 'empty'} value={status}>
                    {status || 'Select call status'}
                  </option>
                ))}
              </select>

              <select
                className="input"
                value={editForm.actionRequired}
                onChange={event => updateEditField('actionRequired', event.target.value)}
              >
                {actionOptions.map(action => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>

              {!isSalesperson && (
                <select
                  className="input"
                  value={editForm.assignedTo}
                  onChange={event => updateEditField('assignedTo', event.target.value)}
                >
                  <option value="">Assign salesperson</option>
                  {salespersons.map(salesperson => (
                    <option key={salesperson._id} value={salesperson._id}>
                      {salesperson.name || salesperson.email}
                    </option>
                  ))}
                </select>
              )}

              <input
                className="input md:col-span-2"
                placeholder="Address"
                value={editForm.address}
                onChange={event => updateEditField('address', event.target.value)}
              />

              <input
                className="input md:col-span-2"
                type="datetime-local"
                value={editForm.followUpDate}
                onChange={event => updateEditField('followUpDate', event.target.value)}
              />

              <textarea
                className="input md:col-span-2"
                rows="3"
                placeholder="Additional info"
                value={editForm.additionalInfo}
                onChange={event => updateEditField('additionalInfo', event.target.value)}
              />

              <textarea
                className="input md:col-span-2"
                rows="3"
                placeholder="Remarks"
                value={editForm.remarks}
                onChange={event => updateEditField('remarks', event.target.value)}
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Lead'}
              </button>

              <button
                type="button"
                onClick={closeEdit}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}