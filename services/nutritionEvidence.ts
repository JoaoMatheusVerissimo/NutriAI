export interface EvidenceItem {
  topic: string;
  summary: string;
  source: string;
}

// Curated, high-level evidence summaries from public health and academic sources.
// Summaries are original text to avoid reproducing copyrighted material.
export const NUTRITION_EVIDENCE_BASE: EvidenceItem[] = [
  {
    topic: 'Healthy diet principles',
    summary:
      'Prioritize adequacy, balance, moderation and diversity with mostly minimally processed foods.',
    source: 'WHO Healthy Diet Fact Sheet (2026): https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  {
    topic: 'Fruits, vegetables and fiber',
    summary:
      'Adults should target at least 400 g/day of fruits and vegetables and around 25 g/day of fiber from whole foods.',
    source: 'WHO Healthy Diet Fact Sheet (2026): https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  {
    topic: 'Sugar intake',
    summary:
      'Keep free sugars below 10% of daily calories, and ideally near or below 5% when feasible.',
    source: 'WHO Sugars Guidance via Healthy Diet Fact Sheet: https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  {
    topic: 'Fat quality',
    summary:
      'Prefer unsaturated fats, keep saturated fat below 10% of calories, and avoid industrial trans fat.',
    source: 'WHO Fat Guidance via Healthy Diet Fact Sheet: https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  {
    topic: 'Sodium and potassium',
    summary:
      'Limit salt to less than 5 g/day (about 2 g sodium) and increase potassium from fruits and vegetables.',
    source: 'WHO Sodium/Potassium Guidance via Healthy Diet Fact Sheet: https://www.who.int/news-room/fact-sheets/detail/healthy-diet',
  },
  {
    topic: 'Meal composition model',
    summary:
      'Use a plate pattern: half vegetables and fruits, one quarter whole grains, one quarter healthy protein; water as default drink.',
    source: 'Harvard Healthy Eating Plate: https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/',
  },
  {
    topic: 'Carbohydrate quality',
    summary:
      'Carbohydrate quality matters more than quantity; choose whole grains, legumes, fruits and non-starchy vegetables over refined grains.',
    source: 'Harvard Nutrition Source and WHO carbohydrate guidance: https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/',
  },
  {
    topic: 'Protein sources',
    summary:
      'Favor fish, legumes, and nuts more often; limit processed meats and reduce red meat frequency.',
    source: 'Harvard Healthy Eating Plate and WHO food guidance: https://nutritionsource.hsph.harvard.edu/healthy-eating-plate/',
  },
  {
    topic: 'Supplements and vitamin D',
    summary:
      'Supplements should complement, not replace, food-first nutrition. Vitamin D has strongest evidence for bone health; avoid high-dose use without clinical indication.',
    source: 'NIH ODS Vitamin D Fact Sheet for Health Professionals (2025): https://ods.od.nih.gov/factsheets/VitaminD-HealthProfessional/',
  },
];

export const buildEvidenceContext = (): string => {
  return NUTRITION_EVIDENCE_BASE.map((item, index) => {
    return `${index + 1}. ${item.topic}: ${item.summary} Fonte: ${item.source}`;
  }).join('\n');
};
