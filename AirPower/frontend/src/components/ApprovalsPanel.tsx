import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  AlertTriangle,
  History,
  FileCheck,
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchApprovals, decideApproval } from '../services/api';
import type { ApprovalRequest } from '../types';

interface ApprovalsPanelProps {
  onRefreshState?: () => void;
}

export const ApprovalsPanel: React.FC<ApprovalsPanelProps> = ({ onRefreshState }) => {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>('WING_COMMANDER');
  const [reviewerName, setReviewerName] = useState<string>('Wing Commander R. K. Sen');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Rejection Dialog state
  const [rejectingApproval, setRejectingApproval] = useState<ApprovalRequest | null>(null);
  const [rejectionRationale, setRejectionRationale] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadApprovals = async () => {
    try {
      const data = await fetchApprovals();
      setApprovals(data);
    } catch (err) {
      console.error('Failed to load approvals:', err);
    }
  };

  useEffect(() => {
    loadApprovals();
  }, []);

  const handleRoleChange = (role: string) => {
    setSelectedRole(role);
    if (role === 'AIR_COMMODORE') {
      setReviewerName('Air Commodore V. Malhotra');
    } else if (role === 'WING_COMMANDER') {
      setReviewerName('Wing Commander R. K. Sen');
    } else if (role === 'SENIOR_OPS_OFFICER') {
      setReviewerName('Squadron Leader A. Joshi');
    } else {
      setReviewerName('Guest Trainee (Viewer)');
    }
  };

  // Action: Approve
  const handleApprove = async (appId: string) => {
    setIsSubmitting(true);
    try {
      await decideApproval(appId, {
        decision: 'APPROVED',
        reviewer_id: reviewerName,
        reviewer_role: selectedRole,
        rationale: 'Approved with operational concurrence per directive.',
      });
      await loadApprovals();
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Reject
  const handleConfirmReject = async () => {
    if (!rejectingApproval) return;
    if (rejectionRationale.trim().length < 8) {
      alert('Reviewer rationale is mandatory when rejecting (min 8 characters).');
      return;
    }

    setIsSubmitting(true);
    try {
      await decideApproval(rejectingApproval.approval_id, {
        decision: 'REJECTED',
        reviewer_id: reviewerName,
        reviewer_role: selectedRole,
        rationale: rejectionRationale,
      });
      setRejectingApproval(null);
      setRejectionRationale('');
      await loadApprovals();
      if (onRefreshState) onRefreshState();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRoleAuthorized = selectedRole !== 'VIEWER';

  const filteredApprovals = approvals.filter((a) => {
    if (statusFilter === 'ALL') return true;
    return a.status === statusFilter;
  });

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="w-full space-y-6 font-mono text-slate-100 select-none">
      {/* Top Header & Role Simulator */}
      <div className="glass-panel p-6 rounded-2xl border border-cyan-500/30 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-black tracking-wider text-white">
                HUMAN-IN-THE-LOOP APPROVAL WORKFLOW
              </h3>
              {pendingCount > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  {pendingCount} PENDING
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Supervised command sign-off for autonomous route deviations, schedule extensions, and resource swaps.
            </p>
          </div>
        </div>

        {/* Local Role Selector */}
        <div className="bg-slate-900 p-3 rounded-xl border border-slate-700/80 space-y-1.5 self-start md:self-auto min-w-[280px]">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
            <span>Active Reviewer Role:</span>
            {!isRoleAuthorized && (
              <span className="text-rose-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> NO SIGN-OFF PERMS
              </span>
            )}
          </div>
          <select
            value={selectedRole}
            onChange={(e) => handleRoleChange(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-bold focus:outline-none"
          >
            <option value="AIR_COMMODORE">Air Commodore (Strategic Authority)</option>
            <option value="WING_COMMANDER">Wing Commander (Tactical Authority)</option>
            <option value="SENIOR_OPS_OFFICER">Senior Ops Officer (Flight Operations)</option>
            <option value="VIEWER">Civilian / Observer (Read-Only Demo Mode)</option>
          </select>
          <div className="text-[10px] text-slate-500">
            Signed in as: <strong className="text-slate-300">{reviewerName}</strong>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 text-[10px]">Filter Decisions:</span>
          {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50 shadow-sm'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <span className="text-[11px] text-slate-400">
          Showing {filteredApprovals.length} proposals
        </span>
      </div>

      {/* Approvals List */}
      <div className="space-y-3">
        {filteredApprovals.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 text-xs">
            No approval requests found for this filter.
          </div>
        ) : (
          filteredApprovals.map((app) => {
            const isPending = app.status === 'PENDING';
            const isApproved = app.status === 'APPROVED';
            const isRejected = app.status === 'REJECTED';

            const badgeColor = isPending
              ? 'bg-amber-950/80 text-amber-300 border-amber-600'
              : isApproved
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600'
              : 'bg-rose-950/80 text-rose-300 border-rose-600';

            return (
              <div
                key={app.approval_id}
                className="bg-slate-900/80 p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition-all space-y-3 shadow-md"
              >
                {/* Proposal Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badgeColor}`}>
                      {app.status}
                    </span>
                    <span className="font-bold text-sm text-white">{app.title}</span>
                    <span className="text-[10px] text-slate-400 font-mono">[{app.approval_id}]</span>
                  </div>

                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span>Requested by: <strong className="text-cyan-300">{app.requesting_agent}</strong></span>
                    <span>•</span>
                    <span>Role Req: <strong className="text-amber-300">{app.reviewer_role_required}</strong></span>
                  </div>
                </div>

                {/* Proposal Type & Timestamps */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400">
                  <span>
                    Proposal Category:{' '}
                    <strong className="text-slate-200">{app.proposal_type.replace(/_/g, ' ')}</strong>
                  </span>
                  <span>
                    Submitted: {new Date(app.created_at).toLocaleString()}
                  </span>
                </div>

                {/* Impact Summary Breakdown */}
                {app.impact_summary && Object.keys(app.impact_summary).length > 0 && (
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                    <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Operational & Resource Impact Assessment:
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      {Object.entries(app.impact_summary).map(([key, val]) => (
                        <div key={key} className="bg-slate-900 p-2 rounded-lg border border-slate-800/80">
                          <span className="text-[10px] text-slate-500 uppercase block truncate">
                            {key.replace(/_/g, ' ')}
                          </span>
                          <span className="font-bold text-slate-200 truncate block">
                            {Array.isArray(val) ? val.join(', ') : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Final Decision Stamp */}
                {!isPending && (
                  <div
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      isApproved
                        ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-200'
                        : 'bg-rose-950/30 border-rose-500/30 text-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span>
                        Finalized as {app.status} by {app.reviewer_id} ({app.reviewer_role})
                      </span>
                      <span>
                        {app.decided_at ? new Date(app.decided_at).toLocaleString() : ''}
                      </span>
                    </div>
                    {app.reviewer_rationale && (
                      <div className="text-xs font-sans text-slate-200 pt-1">
                        <strong>Commander Rationale: </strong>
                        {app.reviewer_rationale}
                      </div>
                    )}
                  </div>
                )}

                {/* Human Supervised Action Bar */}
                {isPending && (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] text-slate-500">
                      Authorised review required before state commit.
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setRejectingApproval(app);
                          setRejectionRationale('');
                        }}
                        disabled={!isRoleAuthorized || isSubmitting}
                        className="px-3.5 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 disabled:opacity-40 text-rose-300 border border-rose-600/60 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        title={!isRoleAuthorized ? 'Viewer cannot decide proposals' : 'Reject proposal with mandatory rationale'}
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>REJECT</span>
                      </button>

                      <button
                        onClick={() => handleApprove(app.approval_id)}
                        disabled={!isRoleAuthorized || isSubmitting}
                        className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                        title={!isRoleAuthorized ? 'Viewer cannot decide proposals' : 'Approve proposal'}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                        <span>APPROVE REVISION</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Mandatory Rejection Rationale Modal */}
      {rejectingApproval && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <AlertTriangle className="w-4 h-4" />
                <span>MANDATORY REJECTION RATIONALE</span>
              </div>
              <button
                onClick={() => setRejectingApproval(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div>Proposal: <strong className="text-white">{rejectingApproval.title}</strong></div>
              <div>Decision Maker: <strong className="text-cyan-300">{reviewerName}</strong> ({selectedRole})</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase text-slate-400 font-bold">
                Reviewer Rationale & Justification (Required for Audit Trail)
              </label>
              <textarea
                rows={3}
                value={rejectionRationale}
                onChange={(e) => setRejectionRationale(e.target.value)}
                placeholder="Explain the tactical, safety, or logistical reason for rejecting this proposal..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 font-sans"
              />
              <span className="text-[10px] text-slate-500">
                Minimum 8 characters required. Will be logged permanently into Event Timeline.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingApproval(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={rejectionRationale.trim().length < 8 || isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
