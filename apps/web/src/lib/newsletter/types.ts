export type ProviderStatus = "ready" | "missing_key" | "error" | "unavailable";

export type ProviderBalance = {
  provider: "openrouter" | "fal";
  status: ProviderStatus;
  label: string;
  balance: number | null;
  currency: string;
  updatedAt: string;
  details?: string;
};

export type Balances = {
  openRouter: ProviderBalance;
  fal: ProviderBalance;
};

export type ProviderModel = {
  id: string;
  name: string;
  description?: string;
  pricing?: string;
  contextLength?: number;
  category?: string;
};

export type Article = {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  published: string | null;
  score: number;
};

export type NewsSource = {
  id: string;
  name: string;
  type: "rss" | "website";
  url: string;
  enabled: boolean;
  limit: number;
  query?: string;
};

export type NewsletterStory = {
  title: string;
  url: string;
  source: string;
  summary: string;
  whyItMatters: string;
};

export type NewsletterSection = {
  id: string;
  heading: string;
  summary: string;
  items: NewsletterStory[];
  feedback?: string;
};

export type NewsletterDraft = {
  subject: string;
  preheader: string;
  intro: string;
  sections: NewsletterSection[];
  imagePrompt: string;
  confidenceScore: number;
  editorialNotes: string[];
};

export type GeneratedImage = {
  url: string;
  contentType: string;
  model: string;
  prompt: string;
  generatedAt: string;
};

export type PromptFieldKey =
  | "scrapeSystemPrompt"
  | "scrapeTaskPrompt"
  | "copySystemPrompt"
  | "copyTaskPrompt"
  | "imageSystemPrompt"
  | "imageTaskPrompt"
  | "globalFeedbackPrompt"
  | "imageFeedbackPrompt";

export type PromptSet = {
  id: string;
  name: string;
  scrapeSystemPrompt: string;
  scrapeTaskPrompt: string;
  copySystemPrompt: string;
  copyTaskPrompt: string;
  imageSystemPrompt: string;
  imageTaskPrompt: string;
  globalFeedbackPrompt: string;
  imageFeedbackPrompt: string;
  promptNames?: Partial<Record<PromptFieldKey, string>>;
  savedPromptFields?: PromptFieldKey[];
  deletedPromptFields?: PromptFieldKey[];
  updatedAt: string;
};

export type MailchimpCampaignDraft = {
  id: string;
  webId?: number;
  title: string;
  status?: string;
  archiveUrl?: string;
  adminUrl?: string;
  checklist?: string[];
};

export type NewsletterPreferences = {
  preferenceId: string;
  sources: NewsSource[];
  copyModel: string;
  scrapeModel: string;
  imageModel: string;
  currentPromptSet: PromptSet | null;
  promptSets: PromptSet[];
  lastPromptSetId: string;
  updatedAt: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};
