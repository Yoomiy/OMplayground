import { useEffect, useRef, useState, type FormEvent } from "react";
import { LogIn, UserRoundCheck, X } from "lucide-react";
import { PasswordInput } from "@/components/PasswordInput";
import { kidFieldInputClass, kidFieldLabelClass } from "@/lib/fieldStyles";
import { supabase } from "@/lib/supabase";
import { usernameToSyntheticEmail } from "@/lib/username";

interface Props {
  classroomTitle: string;
  rememberedUsername: string;
  accountName: string | null;
  rejoinDisabled: boolean;
  onClose: () => void;
  onRejoin: () => void;
}

const primaryButton = "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:opacity-50";
const retryMessage = "לא הצלחנו להתחבר כרגע. בדקו את החיבור ונסו שוב.";

export function ClassroomSignInDialog({
  classroomTitle, rememberedUsername, accountName, rejoinDisabled, onClose, onRejoin,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [username, setUsername] = useState(rememberedUsername);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    if (accountName) {
      setPassword("");
      continueRef.current?.focus();
    } else if (rememberedUsername) {
      passwordRef.current?.focus();
    } else {
      usernameRef.current?.focus();
    }
  }, [accountName, rememberedUsername]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !username.trim() || !password) return;
    setSubmitting(true);
    setErrorMessage("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: usernameToSyntheticEmail(username),
        password,
      });
      if (!error && data.session) {
        setPassword("");
        return;
      }
      if (error?.code === "invalid_credentials") {
        setErrorMessage("שם המשתמש או הסיסמה שגויים. אפשר לנסות שוב.");
      } else if (error?.status === 429) {
        setErrorMessage("בוצעו יותר מדי ניסיונות. כדאי להמתין מעט ולנסות שוב.");
      } else {
        setErrorMessage(retryMessage);
      }
    } catch {
      setErrorMessage(retryMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      dir="rtl"
      aria-labelledby="classroom-sign-in-title"
      aria-describedby="classroom-sign-in-description"
      onCancel={(event) => {
        if (submitting) event.preventDefault();
      }}
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-[2px] dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:p-6"
    >
      <div className="mb-5 flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-400/10 dark:text-indigo-300">
          {accountName ? <UserRoundCheck className="size-5" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 flex-1">
          <h2 id="classroom-sign-in-title" className="text-lg font-black">
            {accountName ? "החשבון שלך מחובר" : "התחברות לכיתה"}
          </h2>
          <p id="classroom-sign-in-description" className="break-words text-sm text-slate-600 dark:text-slate-300">
            {classroomTitle}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          disabled={submitting}
          aria-label="סגירה"
          className="-me-1 -mt-1 grid size-10 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      {accountName ? (
        <div className="space-y-4">
          <p className="break-words rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            התחברת בשם <strong><bdi>{accountName}</bdi></strong>. הצטרפות עם החשבון תנתק אותך מהשיעור לרגע.
          </p>
          <button type="button" onClick={onRejoin} disabled={rejoinDisabled} className={primaryButton}>
            הצטרפות מחדש עם החשבון
          </button>
          <button
            ref={continueRef}
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="min-h-11 w-full rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            להישאר בשיעור
          </button>
        </div>
      ) : (
        <form onSubmit={(event) => void signIn(event)} className="space-y-4">
          <label className={`grid gap-1.5 ${kidFieldLabelClass}`}>
            שם משתמש
            <input
              ref={usernameRef}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              dir="auto"
              required
              disabled={submitting}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={kidFieldInputClass}
            />
          </label>
          <div className="grid gap-1.5">
            <label htmlFor="classroom-sign-in-password" className={kidFieldLabelClass}>סיסמה</label>
            <PasswordInput
              inputRef={passwordRef}
              id="classroom-sign-in-password"
              name="password"
              autoComplete="current-password"
              required
              disabled={submitting}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          {errorMessage && (
            <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">
              {errorMessage}
            </p>
          )}
          <button type="submit" className={primaryButton} disabled={submitting || !username.trim() || !password}>
            {submitting ? "מתחברים…" : "התחברות"}
          </button>
        </form>
      )}
    </dialog>
  );
}
