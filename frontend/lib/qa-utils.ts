import type { Question } from "@/types/api";

export const ALL_CLUSTERS = "All clusters";

export function frequentQuestionTerms(questions: Question[]) {
  const counts = new Map<string, number>();
  questions.slice(0, 12).forEach((question) => {
    [...question.tags, ...(question.key_terms ?? []), question.topic, question.topic_cluster]
      .map((term) => term.trim())
      .filter(Boolean)
      .forEach((term) => {
        const key = term.toLowerCase();
        const existing = Array.from(counts.keys()).find((item) => item.toLowerCase() === key) ?? term;
        counts.set(existing, (counts.get(existing) ?? 0) + 1);
      });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([term]) => term)
    .slice(0, 10);
}

export function questionClusters(questions: Question[]) {
  const values = questions.map((question) => question.topic_cluster).filter(Boolean);
  return [ALL_CLUSTERS, ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))];
}

export function filterQuestions(questions: Question[], archiveSearch: string, selectedCluster: string) {
  const query = archiveSearch.trim().toLowerCase();
  return questions.filter((question) => {
    const matchesCluster = selectedCluster === ALL_CLUSTERS || question.topic_cluster === selectedCluster;
    const matchesQuery = !query || [
      question.title,
      question.topic,
      question.topic_cluster,
      question.body,
      ...question.tags,
      ...(question.key_terms ?? []),
      ...question.answers.flatMap((answer) => [answer.body, answer.summary]),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
    return matchesCluster && matchesQuery;
  });
}
