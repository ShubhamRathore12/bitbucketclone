import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, XCircle, MessageSquare, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';

type ReviewAction = 'approve' | 'request_changes' | 'comment';

interface ReviewPanelProps {
  repoFullName: string;
  prNumber: number;
  onSubmitted: () => void;
  onCancel: () => void;
}

export default function ReviewPanel({ repoFullName, prNumber, onSubmitted, onCancel }: ReviewPanelProps) {
  const [body, setBody] = useState('');
  const [action, setAction] = useState<ReviewAction>('comment');

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(
        `/api/repositories/${repoFullName}/pull-requests/${prNumber}/reviews`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body, status: action }),
        }
      );
      if (!res.ok) throw new Error('Failed to submit review');
      return res.json();
    },
    onSuccess: () => onSubmitted(),
  });

  const options: { value: ReviewAction; label: string; icon: React.ReactNode; description: string; color: string }[] = [
    {
      value: 'approve',
      label: 'Approve',
      icon: <CheckCircle2 className="h-5 w-5" />,
      description: 'Submit feedback and approve merging these changes.',
      color: 'text-green-600 dark:text-green-400',
    },
    {
      value: 'request_changes',
      label: 'Request changes',
      icon: <XCircle className="h-5 w-5" />,
      description: 'Submit feedback that must be addressed before merging.',
      color: 'text-red-600 dark:text-red-400',
    },
    {
      value: 'comment',
      label: 'Comment',
      icon: <MessageSquare className="h-5 w-5" />,
      description: 'Submit general feedback without explicit approval.',
      color: 'text-gray-600 dark:text-gray-400',
    },
  ];

  return (
    <div className="border border-gray-200 rounded-lg dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          Submit your review
        </h3>
      </div>

      <div className="p-4 space-y-4">
        {/* Comment textarea */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Review comment
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Leave a comment (optional for approvals)..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md resize-y
              focus:outline-none focus:ring-2 focus:ring-blue-500
              dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder:text-gray-500"
          />
        </div>

        {/* Action selection */}
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Review decision
          </legend>
          {options.map((opt) => (
            <label
              key={opt.value}
              className={[
                'flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors',
                action === opt.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-400'
                  : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              <input
                type="radio"
                name="review-action"
                value={opt.value}
                checked={action === opt.value}
                onChange={() => setAction(opt.value)}
                className="mt-0.5 accent-blue-600"
              />
              <div className="flex-1">
                <div className={['font-medium text-sm flex items-center gap-1.5', opt.color].join(' ')}>
                  {opt.icon}
                  {opt.label}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.description}</p>
              </div>
            </label>
          ))}
        </fieldset>

        {/* Submit / Cancel */}
        <div className="flex items-center gap-3 justify-end pt-2 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            Submit review
          </Button>
        </div>

        {submitMutation.isError && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {submitMutation.error instanceof Error ? submitMutation.error.message : 'Failed to submit review'}
          </p>
        )}
      </div>
    </div>
  );
}
