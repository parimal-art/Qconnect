import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

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

const normalizeText = value =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizePipeline = value => {
  const normalized = normalizeText(value);

  const aliases = {
    new: 'new lead',
    pending: 'new lead',
    followup: 'follow up',
    'follow up': 'follow up',
    'follow-up': 'follow up',
    demo: 'demo scheduled',
    demoed: 'demo scheduled',
    negotiation: 'negotiation',
    won: 'won',
    win: 'won',
    completed: 'won',
    lost: 'lost',
    loss: 'lost'
  };

  return aliases[normalized] || normalized;
};

const normalizeLeadType = value => {
  const normalized = normalizeText(value);

  const aliases = {
    hot: 'hot lead',
    mid: 'mid lead',
    medium: 'mid lead',
    cold: 'cold lead'
  };

  return aliases[normalized] || normalized;
};

const matchesFilter = (actualValue, filterValue, normalizer = normalizeText) => {
  if (!filterValue || filterValue === 'all') return true;
  return normalizer(actualValue) === normalizer(filterValue);
};

const getAssignedToId = lead => {
  if (!lead?.assignedTo) return '';
  if (typeof lead.assignedTo === 'string') return lead.assignedTo;
  return lead.assignedTo._id || '';
};

const getAssignedToName = lead => {
  if (!lead?.assignedTo) return 'Unassigned';
  if (typeof lead.assignedTo === 'string') return 'Assigned';
  return lead.assignedTo.name || lead.assignedTo.email || 'Assigned';
};

const toDateTimeLocal = value => {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);

  return local.toISOString().slice(0, 16);
};

export default function LeadsPage() {
  const { user } = useSelector(state => state.auth);

  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState(leadInitial);

  const [query, setQuery] = useState('');
  const [view, setView] = useState('table');

  const [completedFilter, setCompletedFilter] = useState('all');
  const [leadTypeFilter, setLeadTypeFilter] = useState('all');
  const [pipelineFilter, setPipelineFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalAmountEdits, setFinalAmountEdits] = useState({});

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isSalesperson = user?.role === ROLES.SALESPERSON;
  const isManagerRole = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.HR, ROLES.TEAM_LEADER].includes(user?.role);

  const salespersons = useMemo(
    () => employees.filter(employee => employee.role === ROLES.SALESPERSON),
    [employees]
  );

  const visibleLeads = useMemo(() => {
    const searchText = normalizeText(query);

    return leads.filter(lead => {
      const completedOk =
        completedFilter === 'all' ||
        (completedFilter === 'completed' && Boolean(lead.isCompleted)) ||
        (completedFilter === 'pending' && !lead.isCompleted);

      const leadTypeOk = matchesFilter(
        lead.leadType || 'Cold Lead',
        leadTypeFilter,
        normalizeLeadType
      );

      const pipelineOk = matchesFilter(
        lead.pipelineStatus || 'New Lead',
        pipelineFilter,
        normalizePipeline
      );

      const searchOk =
        !searchText ||
        [
          lead.name,
          lead.companyName,
          lead.contactNumber,
          lead.email,
          lead.website,
          lead.domain,
          lead.source,
          lead.leadType,
          lead.pipelineStatus,
          lead.callStatus,
          lead.actionRequired,
          lead.remarks,
          getAssignedToName(lead)
        ]
          .map(normalizeText)
          .join(' ')
          .includes(searchText);

      return completedOk && leadTypeOk && pipelineOk && searchOk;
    });
  }, [leads, query, completedFilter, leadTypeFilter, pipelineFilter]);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const [leadResponse, userResponse] = await Promise.all([
        api.get('/leads?limit=100'),
        api.get('/users/children').catch(() => ({
          data: { users: [], data: [] }
        }))
      ]);

      setLeads(leadResponse.data.leads || leadResponse.data.data || []);
      setEmployees(userResponse.data.users || userResponse.data.data || []);
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

  const buildCreatePayload = values => {
    const payload = { ...values };

    Object.keys(payload).forEach(key => {
      if (payload[key] === '') delete payload[key];
    });

    if (payload.followUpDate) {
      payload.followUpDate = new Date(payload.followUpDate);
    }

    if (isSalesperson) {
      delete payload.assignedTo;
    }

    return payload;
  };

  const buildAfterCallPayload = lead => ({
    leadType: lead.leadType || 'Cold Lead',
    pipelineStatus: lead.pipelineStatus || 'New Lead',
    callStatus: lead.callStatus || undefined,
    actionRequired: lead.actionRequired || 'Follow-up',
    remarks: lead.remarks || '',
    followUpDate: lead.followUpDate ? new Date(lead.followUpDate) : undefined
  });

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

    if (isManagerRole && !form.assignedTo) {
      setError('Please assign this lead to a salesperson.');
      return;
    }

    try {
      setSaving(true);

      await api.post('/leads', buildCreatePayload(form));

      setMessage(isSalesperson ? 'Self-generated lead created.' : 'Lead generated and assigned.');
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

  const saveAfterCallUpdate = async lead => {
    setError('');
    setMessage('');

    if (!isSalesperson) {
      setError('Only salesperson can update after-call lead data.');
      return;
    }

    try {
      await api.put(`/leads/${lead._id}/status`, buildAfterCallPayload(lead));

      setMessage('After-call lead data updated.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'After-call update failed.');
    }
  };

  const complete = async lead => {
    setError('');
    setMessage('');

    if (!isSalesperson) {
      setError('Only salesperson can complete a lead.');
      return;
    }

    try {
      await api.put(`/leads/${lead._id}/complete`, {
        ...buildAfterCallPayload(lead),
        pipelineStatus: normalizePipeline(lead.pipelineStatus) === 'lost' ? 'Lost' : 'Won'
      });

      setMessage('Lead marked as completed.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Lead complete failed.');
    }
  };

  const finalizeDeal = async (lead, status = 'finalized') => {
    setError('');
    setMessage('');

    if (!isManagerRole) {
      setError('Only TL, HR, or Admin can finalize deals.');
      return;
    }

    const finalAmount = finalAmountEdits[lead._id] ?? lead.finalizedAmount ?? '';

    if (status === 'finalized' && (!finalAmount || Number(finalAmount) < 0)) {
      setError('Enter a valid final deal amount.');
      return;
    }

    try {
      await api.put(`/leads/${lead._id}/finalize-deal`, {
        status,
        finalAmount: Number(finalAmount || 0)
      });
      setMessage(status === 'finalized' ? 'Deal finalized and sales target updated.' : 'Deal rejected.');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Deal finalization failed.');
    }
  };

  const clearFilters = () => {
    setQuery('');
    setCompletedFilter('all');
    setLeadTypeFilter('all');
    setPipelineFilter('all');
  };

  const managerColumns = [
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
      render: lead => <StatusBadge value={lead.leadType || 'Cold Lead'} />
    },
    {
      key: 'pipelineStatus',
      header: 'Pipeline',
      render: lead => <StatusBadge value={lead.pipelineStatus || 'New Lead'} />
    },
    {
      key: 'callStatus',
      header: 'Call Status',
      render: lead => lead.callStatus || '—'
    },
    {
      key: 'actionRequired',
      header: 'Action',
      render: lead => lead.actionRequired || '—'
    },
    {
      key: 'remarks',
      header: 'Remarks',
      render: lead => lead.remarks || '—'
    },
    {
      key: 'followUpDate',
      header: 'Follow-up',
      render: lead => (lead.followUpDate ? new Date(lead.followUpDate).toLocaleString() : '—')
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      render: lead => {
        const assignedToId = getAssignedToId(lead);

        return assignedToId ? (
          <Link
            to={`/employees/${assignedToId}`}
            className="font-semibold text-blue-600 hover:underline"
          >
            {getAssignedToName(lead)}
          </Link>
        ) : (
          'Unassigned'
        );
      }
    },
    {
      key: 'isCompleted',
      header: 'Completed',
      render: lead => <StatusBadge value={lead.isCompleted ? 'Approved' : 'Pending'} />
    },
    {
      key: 'finalizationStatus',
      header: 'Deal Review',
      render: lead => <StatusBadge value={lead.finalizationStatus || 'not_requested'} />
    },
    {
      key: 'finalizedAmount',
      header: 'Final Amount',
      render: lead => `₹${Number(lead.finalizedAmount || 0).toLocaleString('en-IN')}`
    },
    {
      key: 'dealActions',
      header: 'TL/HR/Admin Actions',
      render: lead => (
        <div className="flex min-w-52 flex-col gap-2">
          {lead.pipelineStatus === 'Won' && lead.finalizationStatus !== 'finalized' && (
            <>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="Final amount"
                value={finalAmountEdits[lead._id] ?? lead.finalizedAmount ?? ''}
                onChange={event =>
                  setFinalAmountEdits(current => ({ ...current, [lead._id]: event.target.value }))
                }
              />
              <button type="button" className="text-left text-sm font-semibold text-emerald-600" onClick={() => finalizeDeal(lead, 'finalized')}>
                Finalize Deal
              </button>
              <button type="button" className="text-left text-sm font-semibold text-rose-600" onClick={() => finalizeDeal(lead, 'rejected')}>
                Reject Won Deal
              </button>
            </>
          )}
          {lead.pipelineStatus === 'Won' && lead.finalizationStatus === 'finalized' && (
            <Link to="/quotations" className="text-sm font-semibold text-blue-600 hover:underline">
              Generate / View Quotation
            </Link>
          )}
          {lead.quotations?.length > 0 && (
            <span className="text-xs text-slate-500">{lead.quotations.length} quotation saved</span>
          )}
        </div>
      )
    }
  ];

  const salespersonColumns = [
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
          disabled={lead.isCompleted}
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
          disabled={lead.isCompleted}
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
          disabled={lead.isCompleted}
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
          disabled={lead.isCompleted}
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
          placeholder="After-call remarks..."
          disabled={lead.isCompleted}
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
          disabled={lead.isCompleted}
        />
      )
    },
    {
      key: 'isCompleted',
      header: 'Completed',
      render: lead => <StatusBadge value={lead.isCompleted ? 'Approved' : 'Pending'} />
    },
    {
      key: 'finalizationStatus',
      header: 'Deal Review',
      render: lead => <StatusBadge value={lead.finalizationStatus || 'not_requested'} />
    },
    {
      key: 'finalizedAmount',
      header: 'Sales Amount',
      render: lead => `₹${Number(lead.finalizedAmount || 0).toLocaleString('en-IN')}`
    },
    {
      key: 'actions',
      header: 'Actions',
      render: lead => (
        <div className="flex min-w-44 flex-col gap-2">
          {!lead.isCompleted && (
            <>
              <button
                type="button"
                onClick={() => saveAfterCallUpdate(lead)}
                className="text-left text-sm font-semibold text-blue-600"
              >
                Save After-call Update
              </button>

              <button
                type="button"
                onClick={() => complete(lead)}
                className="text-left text-sm font-semibold text-emerald-600"
              >
                Complete Lead
              </button>
            </>
          )}

          {lead.isCompleted && (
            <span className="text-sm font-semibold text-emerald-600">Completed</span>
          )}
        </div>
      )
    }
  ];

  if (loading) return <LoadingState rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isSalesperson ? 'My Leads' : 'Lead Management'}
          </h1>
          <p className="text-slate-500">
            {isSalesperson
              ? 'Update only after-call data for your assigned or self-generated leads.'
              : 'Generate, assign, upload, and view pending/completed leads. After-call updates are salesperson-only.'}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Showing {visibleLeads.length} of {leads.length} leads
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setView('table')}
            className={view === 'table' ? 'btn-primary' : 'btn-secondary'}
          >
            Table
          </button>

          <button
            type="button"
            onClick={() => setView('kanban')}
            className={view === 'kanban' ? 'btn-primary' : 'btn-secondary'}
          >
            Kanban
          </button>

          <select
            className="input w-44"
            value={completedFilter}
            onChange={event => setCompletedFilter(event.target.value)}
          >
            <option value="all">All leads</option>
            <option value="pending">Pending leads</option>
            <option value="completed">Completed leads</option>
          </select>

          <select
            className="input w-44"
            value={leadTypeFilter}
            onChange={event => setLeadTypeFilter(event.target.value)}
          >
            <option value="all">All lead types</option>
            {leadTypes.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            className="input w-44"
            value={pipelineFilter}
            onChange={event => setPipelineFilter(event.target.value)}
          >
            <option value="all">All pipeline</option>
            {pipelineStatuses.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={clearFilters}
            className="btn-secondary"
          >
            Clear Filters
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
          {isSalesperson ? 'Add self-generated lead' : 'Generate and assign lead'}
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

          <input
            className="input md:col-span-2"
            placeholder="Address"
            value={form.address}
            onChange={event => updateCreateField('address', event.target.value)}
          />

          {!isSalesperson && (
            <select
              className="input md:col-span-2"
              value={form.assignedTo}
              onChange={event => updateCreateField('assignedTo', event.target.value)}
            >
              <option value="">Assign salesperson *</option>
              {salespersons.map(salesperson => (
                <option key={salesperson._id} value={salesperson._id}>
                  {salesperson.name || salesperson.email}
                </option>
              ))}
            </select>
          )}

          <textarea
            className="input md:col-span-4"
            rows="2"
            placeholder="Additional lead info"
            value={form.additionalInfo}
            onChange={event => updateCreateField('additionalInfo', event.target.value)}
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isSalesperson ? 'Create Self Lead' : 'Generate Lead'}
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
        onChange={event => setQuery(event.target.value)}
      />

      {view === 'kanban' ? (
        <LeadKanban
          leads={visibleLeads}
          onChanged={load}
          canUpdateAfterCall={isSalesperson}
        />
      ) : (
        <DataTable
          columns={isSalesperson ? salespersonColumns : managerColumns}
          rows={visibleLeads}
          keyField="_id"
        />
      )}
    </div>
  );
}
