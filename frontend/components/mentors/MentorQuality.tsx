"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Plus,
  ShieldAlert,
  Star,
  Trash2,
} from "lucide-react";

import {
  createMentorReview,
  fetchMentorAvailability,
  fetchMentorReviews,
  fetchReviewEligibility,
  replaceMentorAvailability,
  requestMentorVerification,
  updateMentorReview,
} from "@/lib/api";
import type {
  AvailabilityMode,
  AvailabilitySlot,
  AvailabilitySlotInput,
  Review,
  ReviewEligibility,
  VerificationStatus,
  Weekday,
} from "@/types/api";

const weekdays: { value: Weekday; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const availabilityModes: { value: AvailabilityMode; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In person" },
  { value: "hybrid", label: "Hybrid" },
];

const verificationStyles: Record<
  VerificationStatus,
  { label: string; className: string }
> = {
  not_applicable: {
    label: "Not applicable",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  unverified: {
    label: "Unverified mentor",
    className: "bg-slate-100 text-slate-700 ring-slate-300",
  },
  pending: {
    label: "Verification pending",
    className: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  verified: {
    label: "Verified mentor",
    className: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  rejected: {
    label: "Verification needs attention",
    className: "bg-rose-50 text-rose-800 ring-rose-200",
  },
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function timeValue(value: string) {
  return value.slice(0, 5);
}

function displayTime(value: string) {
  const [hours, minutes] = timeValue(value).split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour = hours % 12 || 12;
  return `${hour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function VerificationBadge({
  status,
  onDark = false,
}: {
  status: VerificationStatus;
  onDark?: boolean;
}) {
  const style = verificationStyles[status];
  const Icon =
    status === "verified"
      ? CheckCircle2
      : status === "pending"
        ? Clock3
        : ShieldAlert;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1 ${
        onDark ? "bg-white/15 text-white ring-white/30" : style.className
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      {style.label}
    </span>
  );
}

export function RatingStars({
  rating,
  size = 16,
}: {
  rating: number;
  size?: number;
}) {
  const roundedRating = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={size}
          className={
            index < roundedRating ? "text-nusOrange" : "text-[#d5d9e4]"
          }
          fill={index < roundedRating ? "currentColor" : "none"}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function AvailabilityList({ slots }: { slots: AvailabilitySlot[] }) {
  if (!slots.length) {
    return (
      <p className="font-medium text-[#737b8f]">
        This mentor has not published structured availability yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {slots.map((slot) => (
        <div
          key={slot.id}
          className="rounded-xl border border-[#d4dae8] bg-[#f8faff] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-black capitalize">{slot.day_of_week}</p>
              <p className="mt-1 font-medium text-[#596173]">
                {displayTime(slot.start_time)}–{displayTime(slot.end_time)}
              </p>
            </div>
            <span className="chip bg-[#eee9ff] text-nusPurple">
              {availabilityModes.find((mode) => mode.value === slot.mode)
                ?.label ?? slot.mode}
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-[#858ca0]">
            {slot.location || "Location shared after connecting"} ·{" "}
            {slot.timezone}
          </p>
        </div>
      ))}
    </div>
  );
}

export function AvailabilityEditor({
  mentorId,
  token,
  onAvailabilityChange,
}: {
  mentorId: string;
  token: string;
  onAvailabilityChange?: (slots: AvailabilitySlot[]) => void;
}) {
  const [slots, setSlots] = useState<AvailabilitySlotInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMentorAvailability(mentorId)
      .then((items) => {
        if (!active) return;
        setSlots(
          items.map((item) => ({
            day_of_week: item.day_of_week,
            start_time: timeValue(item.start_time),
            end_time: timeValue(item.end_time),
            timezone: item.timezone,
            mode: item.mode,
            location: item.location ?? "",
          })),
        );
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(errorMessage(loadError, "Unable to load availability"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mentorId]);

  function addSlot() {
    setSlots((current) => [
      ...current,
      {
        day_of_week: "monday",
        start_time: "09:00",
        end_time: "10:00",
        timezone: "Asia/Singapore",
        mode: "online",
        location: "",
      },
    ]);
    setMessage("");
  }

  function updateSlot(
    index: number,
    field: keyof AvailabilitySlotInput,
    value: string,
  ) {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [field]: value } : slot,
      ),
    );
    setMessage("");
  }

  async function saveAvailability() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const saved = await replaceMentorAvailability(token, slots);
      setSlots(
        saved.map((item) => ({
          day_of_week: item.day_of_week,
          start_time: timeValue(item.start_time),
          end_time: timeValue(item.end_time),
          timezone: item.timezone,
          mode: item.mode,
          location: item.location ?? "",
        })),
      );
      onAvailabilityChange?.(saved);
      setMessage("Availability saved.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Unable to save availability"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black">Weekly Availability</h3>
          <p className="mt-1 text-sm font-medium text-[#737b8f]">
            Publish the times when students can request a consultation.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#c8cfde] px-4 font-bold text-nusPurple disabled:opacity-50"
          onClick={addSlot}
          disabled={loading || slots.length >= 30}
          type="button"
        >
          <Plus size={17} /> Add slot
        </button>
      </div>

      {loading ? (
        <p className="mt-5 font-medium text-[#737b8f]">Loading availability…</p>
      ) : (
        <div className="mt-5 space-y-4">
          {slots.map((slot, index) => (
            <div
              key={`${slot.day_of_week}-${index}`}
              className="rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-4"
            >
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-sm font-bold text-[#3f4659]">
                  Day
                  <select
                    className="field mt-2"
                    value={slot.day_of_week}
                    onChange={(event) =>
                      updateSlot(index, "day_of_week", event.target.value)
                    }
                  >
                    {weekdays.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-bold text-[#3f4659]">
                  Start
                  <input
                    className="field mt-2"
                    type="time"
                    value={slot.start_time}
                    onChange={(event) =>
                      updateSlot(index, "start_time", event.target.value)
                    }
                  />
                </label>
                <label className="text-sm font-bold text-[#3f4659]">
                  End
                  <input
                    className="field mt-2"
                    type="time"
                    value={slot.end_time}
                    onChange={(event) =>
                      updateSlot(index, "end_time", event.target.value)
                    }
                  />
                </label>
                <label className="text-sm font-bold text-[#3f4659]">
                  Mode
                  <select
                    className="field mt-2"
                    value={slot.mode ?? "online"}
                    onChange={(event) =>
                      updateSlot(index, "mode", event.target.value)
                    }
                  >
                    {availabilityModes.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <label className="text-sm font-bold text-[#3f4659]">
                  Location or meeting details
                  <input
                    className="field mt-2"
                    value={slot.location ?? ""}
                    onChange={(event) =>
                      updateSlot(index, "location", event.target.value)
                    }
                    placeholder="Zoom, COM3-01-01, or leave blank"
                  />
                </label>
                <label className="text-sm font-bold text-[#3f4659]">
                  Timezone
                  <select
                    className="field mt-2"
                    value={slot.timezone ?? "Asia/Singapore"}
                    onChange={(event) =>
                      updateSlot(index, "timezone", event.target.value)
                    }
                  >
                    <option value="Asia/Singapore">Asia/Singapore</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
                <button
                  className="mt-auto inline-flex h-[50px] items-center justify-center rounded-xl border border-rose-200 px-4 font-bold text-rose-700"
                  onClick={() =>
                    setSlots((current) =>
                      current.filter((_, slotIndex) => slotIndex !== index),
                    )
                  }
                  type="button"
                  aria-label={`Remove ${slot.day_of_week} availability`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {!slots.length && (
            <div className="dash-placeholder p-5 text-center font-medium text-[#737b8f]">
              No structured slots yet. Add your first available time above.
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-4 font-bold text-rose-700">{error}</p>}
      {message && <p className="mt-4 font-bold text-emerald-700">{message}</p>}
      <button
        className="mt-5 h-11 rounded-xl bg-nusPurple px-6 font-bold text-white disabled:opacity-60"
        onClick={saveAvailability}
        disabled={loading || saving}
        type="button"
      >
        {saving ? "Saving availability…" : "Save availability"}
      </button>
    </section>
  );
}

export function VerificationControls({
  status,
  token,
  onStatusChange,
}: {
  status: VerificationStatus;
  token: string;
  onStatusChange?: (status: VerificationStatus) => void;
}) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setCurrentStatus(status), [status]);

  async function requestVerification() {
    setSubmitting(true);
    setError("");
    try {
      const result = await requestMentorVerification(token);
      setCurrentStatus(result.status);
      onStatusChange?.(result.status);
    } catch (requestError) {
      setError(
        errorMessage(requestError, "Unable to request mentor verification"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  const canRequest = ["unverified", "rejected"].includes(currentStatus);
  return (
    <section className="card p-6">
      <h3 className="text-lg font-black">Mentor Verification</h3>
      <div className="mt-4">
        <VerificationBadge status={currentStatus} />
      </div>
      <p className="mt-4 text-sm font-medium text-[#737b8f]">
        {currentStatus === "verified"
          ? "Your mentor profile is verified and shows a public trust badge."
          : currentStatus === "pending"
            ? "Your request is awaiting review. The pending badge is visible on your profile."
            : "Request verification when your mentor details are complete."}
      </p>
      {canRequest && (
        <button
          className="mt-4 h-11 w-full rounded-xl bg-nusPurple px-4 font-bold text-white disabled:opacity-60"
          onClick={requestVerification}
          disabled={submitting}
          type="button"
        >
          {submitting ? "Requesting…" : "Request verification"}
        </button>
      )}
      {error && <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>}
    </section>
  );
}

export function MentorReviewSection({
  mentorId,
  token,
  isStudent,
  onReviewsChange,
}: {
  mentorId: string;
  token: string;
  isStudent: boolean;
  onReviewsChange?: () => Promise<void> | void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(
    null,
  );
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const existingReview = eligibility?.existing_review;

  useEffect(() => {
    let active = true;
    setLoading(true);
    const reviewRequest = fetchMentorReviews(mentorId);
    const eligibilityRequest = isStudent
      ? fetchReviewEligibility(token, mentorId)
      : Promise.resolve(null);
    Promise.all([reviewRequest, eligibilityRequest])
      .then(([reviewItems, reviewEligibility]) => {
        if (!active) return;
        setReviews(reviewItems);
        setEligibility(reviewEligibility);
        if (reviewEligibility?.existing_review) {
          setRating(reviewEligibility.existing_review.rating);
          setComment(reviewEligibility.existing_review.comment);
        } else {
          setRating(5);
          setComment("");
        }
        setError("");
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(errorMessage(loadError, "Unable to load mentor reviews"));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isStudent, mentorId, token]);

  async function submitReview() {
    if (!eligibility?.can_review && !existingReview) return;
    setSubmitting(true);
    setError("");
    try {
      if (existingReview) {
        await updateMentorReview(token, existingReview.id, rating, comment);
      } else {
        await createMentorReview(token, mentorId, rating, comment);
      }
      const [reviewItems, reviewEligibility] = await Promise.all([
        fetchMentorReviews(mentorId),
        fetchReviewEligibility(token, mentorId),
      ]);
      setReviews(reviewItems);
      setEligibility(reviewEligibility);
      if (reviewEligibility.existing_review) {
        setRating(reviewEligibility.existing_review.rating);
        setComment(reviewEligibility.existing_review.comment);
      }
      await onReviewsChange?.();
    } catch (submitError) {
      setError(errorMessage(submitError, "Unable to save your review"));
    } finally {
      setSubmitting(false);
    }
  }

  const canShowForm = isStudent && (eligibility?.can_review || existingReview);
  return (
    <section className="card p-6">
      <div>
        <h3 className="text-lg font-black">Ratings and Reviews</h3>
        <p className="mt-1 text-sm font-medium text-[#737b8f]">
          Reviews come from students with accepted mentor connections.
        </p>
      </div>

      {canShowForm && (
        <div className="mt-5 rounded-2xl border border-[#d4dae8] bg-[#f8faff] p-5">
          <h4 className="font-black">
            {existingReview ? "Edit your review" : "Review this mentor"}
          </h4>
          <div className="mt-3 flex items-center gap-2">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              return (
                <button
                  key={value}
                  className={
                    value <= rating ? "text-nusOrange" : "text-[#c9ceda]"
                  }
                  onClick={() => setRating(value)}
                  type="button"
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                >
                  <Star size={25} fill="currentColor" />
                </button>
              );
            })}
            <span className="ml-2 text-sm font-black text-[#596173]">
              {rating}/5
            </span>
          </div>
          <label className="mt-4 block text-sm font-bold text-[#3f4659]">
            Your comments
            <textarea
              className="field mt-2 min-h-24 resize-y py-3"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              placeholder="Share what was useful about this mentorship experience."
            />
          </label>
          <button
            className="mt-4 h-11 rounded-xl bg-nusPurple px-6 font-bold text-white disabled:opacity-60"
            onClick={submitReview}
            disabled={submitting}
            type="button"
          >
            {submitting
              ? "Saving review…"
              : existingReview
                ? "Update review"
                : "Submit review"}
          </button>
        </div>
      )}

      {isStudent && !loading && eligibility && !canShowForm && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {eligibility.reason}
        </div>
      )}
      {error && <p className="mt-4 font-bold text-rose-700">{error}</p>}

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="font-medium text-[#737b8f]">Loading reviews…</p>
        ) : reviews.length ? (
          reviews.map((review) => (
            <article
              key={review.id}
              className="border-b border-[#eef1f7] pb-4 last:border-b-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RatingStars rating={review.rating} />
                <time className="text-xs font-bold text-[#9aa1b3]">
                  {formatDate(review.updated_at)}
                </time>
              </div>
              <p className="mt-2 font-medium text-[#596173]">
                {review.comment ||
                  "Rating submitted without a written comment."}
              </p>
              <p className="mt-2 text-sm font-bold text-[#8b91a5]">
                {review.student_name}
              </p>
            </article>
          ))
        ) : (
          <div className="dash-placeholder p-5 text-center font-medium text-[#737b8f]">
            No reviews yet. The first review can be submitted after an accepted
            mentor connection.
          </div>
        )}
      </div>
    </section>
  );
}
