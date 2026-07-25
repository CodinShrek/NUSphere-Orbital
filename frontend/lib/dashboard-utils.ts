import type { Question, User } from "@/types/api";

export function profileCompletion(user: User) {
  const checks = [
    user.name,
    user.email,
    user.faculty,
    user.major,
    user.bio,
    user.interests.length,
    user.goals.length,
    user.modules_taken.length,
    user.ccas.length,
    user.nus_opportunities.length,
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

export function relatedQuestionsForUser(user: User, questions: Question[]) {
  return questions
    .filter((question) => {
      const searchable = [
        question.title,
        question.topic,
        question.body,
        ...question.tags,
        ...question.key_terms,
      ]
        .join(" ")
        .toLowerCase();
      return [user.major, user.faculty, ...user.interests].some(
        (term) => term && searchable.includes(term.toLowerCase()),
      );
    })
    .slice(0, 4);
}
