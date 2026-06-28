/**
 * Landing page copy.
 * Fields here hold i18n message keys (namespace "landing"); components render
 * them with next-intl's t(). Edit the actual copy in messages/*.json, and edit
 * structure / keys here.
 */

export const productSection = {
  overline: "product.overline",
  title: "product.title",
  subtitle: "product.subtitle",
  features: [
    {
      key: "write",
      label: "product.feature.write.label",
      title: "product.feature.write.title",
      body: "product.feature.write.body",
    },
    {
      key: "rewrite",
      label: "product.feature.rewrite.label",
      title: "product.feature.rewrite.title",
      body: "product.feature.rewrite.body",
    },
    {
      key: "review",
      label: "product.feature.review.label",
      title: "product.feature.review.title",
      body: "product.feature.review.body",
    },
  ],
} as const;

export const jobsSection = {
  overline: "jobs.overline",
  title: "jobs.title",
  subtitle: "jobs.subtitle",
  categories: [
    { key: "frontend", name: "jobs.category.frontend.name", tags: "jobs.category.frontend.tags" },
    { key: "backend", name: "jobs.category.backend.name", tags: "jobs.category.backend.tags" },
    { key: "product", name: "jobs.category.product.name", tags: "jobs.category.product.tags" },
    { key: "data", name: "jobs.category.data.name", tags: "jobs.category.data.tags" },
    { key: "design", name: "jobs.category.design.name", tags: "jobs.category.design.tags" },
    { key: "marketing", name: "jobs.category.marketing.name", tags: "jobs.category.marketing.tags" },
    { key: "ai", name: "jobs.category.ai.name", tags: "jobs.category.ai.tags" },
    { key: "security", name: "jobs.category.security.name", tags: "jobs.category.security.tags" },
  ],
} as const;

export const philosophySection = {
  overline: "philosophy.overline",
  title: "philosophy.title",
  subtitle: "philosophy.subtitle",
  principles: [
    {
      key: "honest",
      label: "philosophy.principle.honest.label",
      body: "philosophy.principle.honest.body",
    },
    {
      key: "deStudent",
      label: "philosophy.principle.deStudent.label",
      body: "philosophy.principle.deStudent.body",
    },
    {
      key: "verbFirst",
      label: "philosophy.principle.verbFirst.label",
      body: "philosophy.principle.verbFirst.body",
    },
    {
      key: "results",
      label: "philosophy.principle.results.label",
      body: "philosophy.principle.results.body",
    },
  ],
} as const;

export const pricingSection = {
  overline: "pricing.overline",
  title: "pricing.title",
  subtitle: "pricing.subtitle",
  tiers: [
    {
      key: "free",
      name: "pricing.tier.free.name",
      price: "pricing.tier.free.price",
      priceUnit: "pricing.tier.free.priceUnit",
      description: "pricing.tier.free.description",
      features: [
        "pricing.tier.free.features.0",
        "pricing.tier.free.features.1",
        "pricing.tier.free.features.2",
        "pricing.tier.free.features.3",
        "pricing.tier.free.features.4",
        "pricing.tier.free.features.5",
      ],
      ctaLabel: "pricing.tier.free.ctaLabel",
      ctaHref: "/login",
      highlighted: true,
    },
    {
      key: "pro",
      name: "pricing.tier.pro.name",
      price: "pricing.tier.pro.price",
      priceUnit: "pricing.tier.pro.priceUnit",
      description: "pricing.tier.pro.description",
      features: [
        "pricing.tier.pro.features.0",
        "pricing.tier.pro.features.1",
        "pricing.tier.pro.features.2",
        "pricing.tier.pro.features.3",
        "pricing.tier.pro.features.4",
      ],
      ctaLabel: "pricing.tier.pro.ctaLabel",
      ctaHref: "/billing/start",
      highlighted: false,
    },
  ],
} as const;
