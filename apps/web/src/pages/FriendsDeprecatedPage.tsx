import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FRIENDS_DEPRECATION_MESSAGE } from "@/lib/friendsDeprecation";

export function FriendsDeprecatedPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-slate-900">Friends is deprecated</h1>
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        {FRIENDS_DEPRECATION_MESSAGE}
      </p>
      <p className="text-sm text-slate-600">
        The old friends flow is intentionally kept in the codebase for possible
        future rollback.
      </p>
      <Button variant="outline" asChild>
        <Link to="/home">Back to Home</Link>
      </Button>
    </div>
  );
}
