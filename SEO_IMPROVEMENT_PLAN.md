# Brooklyn Shamrocks GAA - SEO Audit & Improvement Plan

**Audit Date:** February 4, 2026
**Website:** https://brooklynshamrocks.com
**Technology Stack:** Astro 4.16.0, Tailwind CSS 3.4.0

---

## Executive Summary

The Brooklyn Shamrocks GAA website has a solid technical foundation with Astro's static site generation providing excellent performance and crawlability. The site scores **7/10 overall** with strengths in site architecture, content quality, and mobile experience. Key improvement areas include schema markup implementation (currently non-existent), image optimization, and social media meta tags.

### Current Scorecard

| Category | Score | Status |
|----------|-------|--------|
| Technical SEO | 7/10 | Good |
| On-Page SEO | 7/10 | Good |
| Site Architecture | 9/10 | Excellent |
| Content Quality | 9/10 | Excellent |
| Image Optimization | 4/10 | Poor |
| Schema Markup | 0/10 | Non-existent |
| Social Optimization | 5/10 | Basic |
| Mobile Experience | 9/10 | Excellent |
| **Overall** | **7/10** | **Good** |

---

## Current SEO Implementation

### What's Working Well

- **Page Titles**: All pages follow consistent format: `{Page} | Brooklyn Shamrocks GAA`
- **Meta Descriptions**: Present on most pages
- **Basic Open Graph**: `og:title`, `og:description`, `og:type`, `og:site_name` implemented
- **robots.txt**: Properly configured, allows all crawlers
- **URL Structure**: Clean, semantic URLs with lowercase hyphenated slugs
- **Semantic HTML**: Proper use of `nav`, `main`, `footer`, `article`, `section`
- **Heading Hierarchy**: Generally follows best practices with H1-H3 structure
- **Mobile Responsive**: Tailwind CSS ensures mobile-friendly design
- **Image Alt Text**: All images have descriptive alt attributes
- **Lazy Loading**: Implemented on dynamically rendered images
- **Accessibility**: Aria-labels on interactive elements

### What's Missing

- No JSON-LD schema markup
- No Twitter Card meta tags
- No canonical tags
- No `og:image` for social sharing
- No `og:url` tags
- Sitemap.xml needs verification
- Large unoptimized images (up to 549KB)
- No WebP image format
- No responsive image srcset
- Updates page missing meta description

---

## Improvement Plan

### Phase 1: High Priority (Critical SEO Fixes)

#### 1.1 Add JSON-LD Schema Markup

**Impact:** High | **Effort:** Medium

Add structured data to improve search engine understanding and enable rich results.

**Organization Schema** (add to BaseLayout.astro):
```json
{
  "@context": "https://schema.org",
  "@type": "SportsOrganization",
  "name": "Brooklyn Shamrocks GAA",
  "alternateName": "Brooklyn Shamrocks",
  "url": "https://brooklynshamrocks.com",
  "logo": "https://brooklynshamrocks.com/images/crest_white_bg.png",
  "foundingDate": "1955",
  "description": "Brooklyn Shamrocks GAA is New York's oldest Gaelic Athletic Association club, founded in 1955.",
  "sport": "Gaelic Football",
  "location": {
    "@type": "Place",
    "name": "Randalls Island Field 73",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "New York",
      "addressRegion": "NY",
      "addressCountry": "US"
    }
  },
  "sameAs": [
    "https://www.facebook.com/BrooklynShamrocksGAA",
    "https://www.instagram.com/brooklynshamrocksgaa",
    "https://twitter.com/BklynShamrocks"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "brooklynshamrocksgaa@gmail.com",
    "contactType": "general"
  }
}
```

**Event Schema** (for fixtures page):
```json
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "name": "Brooklyn Shamrocks vs [Opponent]",
  "startDate": "[ISO Date]",
  "location": {
    "@type": "Place",
    "name": "Gaelic Park",
    "address": "Bronx, NY"
  },
  "homeTeam": {
    "@type": "SportsTeam",
    "name": "Brooklyn Shamrocks"
  },
  "awayTeam": {
    "@type": "SportsTeam",
    "name": "[Opponent]"
  }
}
```

#### 1.2 Add Twitter Card Meta Tags

**Impact:** High | **Effort:** Low

Add to BaseLayout.astro head section:
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@BklynShamrocks">
<meta name="twitter:title" content="{title}">
<meta name="twitter:description" content="{description}">
<meta name="twitter:image" content="https://brooklynshamrocks.com/images/og-image.jpg">
```

#### 1.3 Add Open Graph Image

**Impact:** High | **Effort:** Low

Create an OG image (1200x630px) and add:
```html
<meta property="og:image" content="https://brooklynshamrocks.com/images/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Brooklyn Shamrocks GAA - New York's Oldest GAA Club">
```

#### 1.4 Add Canonical Tags

**Impact:** High | **Effort:** Low

Add to every page in BaseLayout.astro:
```html
<link rel="canonical" href="https://brooklynshamrocks.com{Astro.url.pathname}">
```

#### 1.5 Image Optimization

**Impact:** High | **Effort:** Medium

| Image | Current Size | Target Size |
|-------|-------------|-------------|
| Brooklyn_players_for_newYork_vs_leitrim_win.jpg | 549KB | <100KB |
| 2012_team.jpeg | 315KB | <80KB |
| 1979_2.jpeg | 261KB | <60KB |
| 2012_winners.jpeg | 228KB | <60KB |
| 1979.jpeg | 135KB | <50KB |
| 2014_team.jpg | 135KB | <50KB |

**Actions:**
1. Compress all images using tools like ImageOptim or Squoosh
2. Convert to WebP format with JPEG fallback
3. Implement responsive images with srcset:
```html
<img
  src="image.webp"
  srcset="image-400.webp 400w, image-800.webp 800w, image-1200.webp 1200w"
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt="Description"
  loading="lazy"
>
```

#### 1.6 Verify Sitemap Generation

**Impact:** High | **Effort:** Low

1. Install Astro sitemap integration if not present:
```bash
npx astro add sitemap
```

2. Configure in `astro.config.mjs`:
```javascript
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://brooklynshamrocks.com',
  integrations: [sitemap()],
});
```

3. Verify sitemap at `https://brooklynshamrocks.com/sitemap.xml` after deployment

---

### Phase 2: Medium Priority (Enhanced SEO)

#### 2.1 Add Missing Meta Descriptions

**Impact:** Medium | **Effort:** Low

Update `/updates` page with custom description:
```astro
---
const description = "Latest news, match reports, and announcements from Brooklyn Shamrocks GAA, New York's oldest Gaelic Athletic Association club.";
---
<BaseLayout title="Updates" description={description}>
```

#### 2.2 Add og:url Tags

**Impact:** Medium | **Effort:** Low

Add to BaseLayout.astro:
```html
<meta property="og:url" content="https://brooklynshamrocks.com{Astro.url.pathname}">
```

#### 2.3 Implement BreadcrumbList Schema

**Impact:** Medium | **Effort:** Low

For team pages, add:
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://brooklynshamrocks.com"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Teams",
      "item": "https://brooklynshamrocks.com/teams"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Senior Football",
      "item": "https://brooklynshamrocks.com/teams/senior-football"
    }
  ]
}
```

#### 2.4 Local SEO Enhancements

**Impact:** Medium | **Effort:** Medium

Add LocalBusiness schema for training location:
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Brooklyn Shamrocks GAA Training Ground",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Randalls Island Field 73",
    "addressLocality": "New York",
    "addressRegion": "NY",
    "postalCode": "10035",
    "addressCountry": "US"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "40.7934",
    "longitude": "-73.9213"
  },
  "openingHours": "Tu 19:00-21:00, Th 19:00-21:00"
}
```

#### 2.5 Core Web Vitals Optimization

**Impact:** Medium | **Effort:** Medium

1. Add resource hints for external resources:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="dns-prefetch" href="https://www.google.com">
```

2. Optimize Largest Contentful Paint (LCP):
   - Preload hero images
   - Use `fetchpriority="high"` on above-the-fold images

3. Minimize Cumulative Layout Shift (CLS):
   - Add explicit width/height to images
   - Reserve space for dynamic content

---

### Phase 3: Low Priority (Nice to Have)

#### 3.1 Add FAQ Schema

**Impact:** Low | **Effort:** Low

For About or Contact pages:
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "How do I join Brooklyn Shamrocks?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Contact us at brooklynshamrocksgaa@gmail.com or come to our training sessions."
      }
    }
  ]
}
```

#### 3.2 Add Author/Copyright Meta Tags

**Impact:** Low | **Effort:** Low

```html
<meta name="author" content="Brooklyn Shamrocks GAA">
<meta name="copyright" content="Brooklyn Shamrocks GAA">
```

#### 3.3 Implement Visual Breadcrumb Navigation

**Impact:** Low | **Effort:** Medium

Add breadcrumb UI component for improved user experience on nested pages.

#### 3.4 Google Search Console Setup

**Impact:** Medium | **Effort:** Low

1. Verify site ownership
2. Submit sitemap
3. Monitor crawl errors
4. Track keyword rankings
5. Review mobile usability reports

#### 3.5 Analytics Implementation

**Impact:** Medium | **Effort:** Low

If not already implemented, add Google Analytics or privacy-friendly alternative (Plausible, Fathom):
```html
<!-- Add to BaseLayout.astro -->
<script defer data-domain="brooklynshamrocks.com" src="https://plausible.io/js/script.js"></script>
```

---

## Implementation Checklist

### Phase 1 - High Priority
- [ ] Create SEO component with JSON-LD schema markup
- [ ] Add Organization schema to BaseLayout
- [ ] Add Event schema to fixtures page
- [ ] Implement Twitter Card meta tags
- [ ] Create OG image (1200x630px)
- [ ] Add og:image meta tags
- [ ] Add canonical tags to all pages
- [ ] Compress all history images
- [ ] Convert images to WebP format
- [ ] Add responsive srcset to images
- [ ] Verify/install Astro sitemap integration
- [ ] Test sitemap generation in build

### Phase 2 - Medium Priority
- [ ] Add meta description to Updates page
- [ ] Add og:url tags
- [ ] Implement BreadcrumbList schema for team pages
- [ ] Add LocalBusiness schema
- [ ] Add resource hints (preconnect, dns-prefetch)
- [ ] Optimize LCP with image preloading
- [ ] Add width/height to all images for CLS

### Phase 3 - Low Priority
- [ ] Add FAQ schema to About/Contact pages
- [ ] Add author/copyright meta tags
- [ ] Implement visual breadcrumb navigation
- [ ] Set up Google Search Console
- [ ] Implement analytics tracking

---

## Technical Implementation Notes

### BaseLayout.astro Updates

The BaseLayout component should be updated to include:

1. **Props interface** with optional SEO fields:
```typescript
interface Props {
  title: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  schema?: object;
}
```

2. **Default values** for missing props
3. **Conditional rendering** for optional meta tags
4. **Schema script injection** for JSON-LD

### Recommended File Structure

```
src/
├── components/
│   └── SEO/
│       ├── BaseHead.astro      # Core meta tags
│       ├── OpenGraph.astro     # OG tags
│       ├── TwitterCard.astro   # Twitter tags
│       └── Schema.astro        # JSON-LD wrapper
├── schemas/
│   ├── organization.json       # Organization schema
│   ├── localBusiness.json      # Location schema
│   └── event.ts                # Dynamic event schema generator
```

---

## Expected Outcomes

After implementing all phases:

| Category | Current | Target |
|----------|---------|--------|
| Technical SEO | 7/10 | 9/10 |
| On-Page SEO | 7/10 | 9/10 |
| Site Architecture | 9/10 | 9/10 |
| Content Quality | 9/10 | 9/10 |
| Image Optimization | 4/10 | 9/10 |
| Schema Markup | 0/10 | 9/10 |
| Social Optimization | 5/10 | 9/10 |
| Mobile Experience | 9/10 | 10/10 |
| **Overall** | **7/10** | **9/10** |

### Key Performance Indicators (KPIs)

- **Page Load Time**: Target < 2 seconds
- **Lighthouse SEO Score**: Target 95+
- **Core Web Vitals**: All metrics "Good"
- **Social Shares**: Proper previews on all platforms
- **Search Visibility**: Rich results for events and organization

---

## Resources

- [Schema.org Validator](https://validator.schema.org/)
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [Astro SEO Integration](https://docs.astro.build/en/guides/integrations-guide/sitemap/)

---

*Document prepared for Brooklyn Shamrocks GAA website optimization*
