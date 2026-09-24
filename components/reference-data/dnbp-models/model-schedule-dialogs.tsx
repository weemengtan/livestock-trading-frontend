"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { earliestActivationDate } from "@/lib/activation-date";
import { useAuthStore } from "@/lib/auth-store";
import { dnbpModelsApi, type DnbpModel } from "@/lib/dnbp-models-api";
import { strings } from "@/lib/strings";
import { withErrorToast } from "@/lib/with-error-toast";

const copy = strings.referenceData.dnbpModels;

/** Moves a model's go-live date. An approved model drops back to draft (the server withdraws its approval). */
export function RescheduleDialog({
  model,
  onClose,
  onChanged,
}: {
  model: DnbpModel;
  onClose: () => void;
  onChanged: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const earliest = React.useMemo(() => earliestActivationDate(), []);
  const [date, setDate] = React.useState(model.activation_date < earliest ? earliest : model.activation_date);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const updated = await withErrorToast(() => dnbpModelsApi.reschedule(model.id, date, accessToken), "Could not change the date");
    setSaving(false);
    if (!updated) return;
    toast({ title: model.status === "SCHEDULED" ? copy.reschedule.toast : "Date changed" });
    onChanged();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>
          {copy.reschedule.title} — {model.name}
        </DialogTitle>
        {model.status === "SCHEDULED" ? (
          <DialogDescription>{copy.reschedule.withdrawsApproval}</DialogDescription>
        ) : null}
        <form className="mt-4 flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reschedule-date">{copy.form.activationDate}</Label>
            <Input
              id="reschedule-date"
              type="date"
              value={date}
              min={earliest}
              onChange={(e) => setDate(e.target.value)}
              aria-describedby="reschedule-date-hint"
              required
            />
            <p id="reschedule-date-hint" className="text-xs text-fg-tertiary">
              {copy.form.activationHint}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={saving || date < earliest}>
              {copy.reschedule.submit}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelDialog({
  model,
  onClose,
  onChanged,
}: {
  model: DnbpModel;
  onClose: () => void;
  onChanged: () => void;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [cancelling, setCancelling] = React.useState(false);

  async function handleCancel() {
    setCancelling(true);
    const updated = await withErrorToast(() => dnbpModelsApi.cancel(model.id, accessToken), "Could not cancel the model");
    setCancelling(false);
    if (!updated) return;
    toast({ title: copy.cancel.toast });
    onChanged();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogTitle>
          {copy.cancel.title} — {model.name}
        </DialogTitle>
        <DialogDescription>{copy.cancel.body}</DialogDescription>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="secondary">{copy.cancel.keep}</Button>
          </DialogClose>
          <Button variant="danger" onClick={handleCancel} disabled={cancelling}>
            {copy.cancel.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
