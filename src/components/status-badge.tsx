export function StatusBadge({ status }: { status: string }) {
  return status === "open" ? (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-bold text-green-700">● Dibuka</span>
  ) : (
    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-sm font-bold text-gray-600">Ditutup</span>
  );
}
