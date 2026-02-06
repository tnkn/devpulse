"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  repoKey: string;
  repoName: string;
}

export function DeleteButton({ repoKey, repoName }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/github/collect/repo?key=${encodeURIComponent(repoKey)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      router.push("/");
      router.refresh();
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  if (deleting) {
    return (
      <span className="text-sm text-gray-500 dark:text-gray-400">
        Deleting...
      </span>
    );
  }

  if (confirming) {
    return (
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-red-600 dark:text-red-400">
          Delete {repoName}?
        </span>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="px-4 py-2 text-sm text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
    >
      Delete
    </button>
  );
}
