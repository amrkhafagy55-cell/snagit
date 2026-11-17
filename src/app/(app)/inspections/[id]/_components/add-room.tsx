"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import { useErrorText, useI18n } from "@/lib/i18n/client";
import { ROOM_TYPES, type RoomType } from "@/lib/types";
import { addRoomAction } from "../../../_actions/inspections";

export function AddRoomForm({ inspectionId }: { inspectionId: string }) {
  const { t } = useI18n();
  const errorText = useErrorText();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [roomType, setRoomType] = useState<RoomType>("other");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-navy-200 p-4 text-sm font-semibold text-navy-500 transition hover:border-navy-400 hover:text-navy-800"
      >
        <Plus className="size-4" aria-hidden />
        {t.workspace.addRoom}
      </button>
    );
  }

  return (
    <form
      className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addRoomAction(inspectionId, roomType, name);
          if (!res.ok) return setError(res.error);
          setName("");
          setOpen(false);
          router.push(`/inspections/${inspectionId}/rooms/${res.data.roomId}`);
        });
      }}
    >
      <div className="sm:w-48">
        <label htmlFor="room-type" className="field-label">
          {t.workspace.roomType}
        </label>
        <select id="room-type" className="field-input" value={roomType} onChange={(e) => setRoomType(e.target.value as RoomType)}>
          {ROOM_TYPES.map((r) => (
            <option key={r} value={r}>
              {t.rooms[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor="room-name" className="field-label">
          {t.workspace.roomName} <span className="font-normal text-navy-400">({t.app.optional})</span>
        </label>
        <input
          id="room-name"
          className="field-input"
          value={name}
          maxLength={80}
          placeholder={t.workspace.roomNameHint}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          {t.app.cancel}
        </Button>
        <Button type="submit" variant="primary" loading={pending}>
          {pending ? t.workspace.adding : t.workspace.add}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600 sm:basis-full">{errorText(error)}</p>}
    </form>
  );
}
