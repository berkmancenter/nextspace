# Analytics Setup Guide

Complete guide for configuring Matomo Tag Manager analytics in NextSpace.

**Table of Contents:**
- [Quick Start: Enable/Disable Analytics](#quick-start-enabledisable-analytics)
- [Step 1: Matomo Configuration](#step-1-matomo-configuration)
- [Step 2: MTM Configuration](#step-2-mtm-configuration)
- [Step 3: Testing & Verification](#step-3-testing--verification)
- [Troubleshooting](#troubleshooting)

---

## Quick Start: Enable/Disable Analytics

### Disabling Analytics

To completely disable Matomo analytics tracking:

```bash
# Add to .env file
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

**When disabled:**
- ✅ Matomo script will not load
- ✅ No tracking functions execute
- ✅ No network requests to Matomo servers
- ✅ Application continues to function normally

### Enabling Analytics (Default)

```bash
# Add to .env file or omit entirely
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

**Configuration by Environment:**

```bash
# .env.development - disable for local dev
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# .env.production - enable for production
NEXT_PUBLIC_ENABLE_ANALYTICS=true
```

---

## Step 1: Matomo Configuration

### Prerequisites

Before starting, ensure you have:
- Access to Matomo interface
- Admin rights to create custom dimensions
- Your Matomo instance URL (e.g., `stats.berkman.harvard.edu`)
- Your Site ID (e.g., `18`)

### 1.1: Create Custom Dimensions

You need to configure 3 custom dimensions in your Matomo instance:

**Access Custom Dimensions:**
1. Log into Matomo
2. Go to **Administration** → **Custom Dimensions**
3. Click **Add a new dimension**

**Create these dimensions:**

#### Dimension 2: user_location
- **Name:** `user_location`
- **Scope:** Visit
- **Description:** Whether user is accessing from local venue or remotely (values: "local" or "remote")

#### Dimension 4: page_duration
- **Name:** `page_duration`
- **Scope:** Action
- **Description:** Time spent on a specific page in seconds

#### Dimension 6: conversation_id
- **Name:** `conversation_id`
- **Scope:** Action
- **Description:** The UUID of the conversation for tracking conversation-specific events

**Note:** The dimension index numbers should be 2, 4, and 6. If they differ, you'll need to adjust the code in `utils/analytics.ts`.

**Historical Note:** Dimensions 1, 3, and 5 were previously used but are no longer actively tracked. They cannot be deleted from Matomo but will not receive new data.

---

## Step 2: MTM Configuration

**Estimated time:** 45-60 minutes for first-time setup

### 2.1: Access Matomo Tag Manager

1. Log into **Matomo Tag Manager** (MTM)
2. Select your **Container**
3. You'll configure: Variables → Tags → Triggers → Publish

### 2.2: Create Data Layer Variables

**Go to Variables (left sidebar) → Create New Variable**

Create these 15 variables (Type: **Data Layer Variable** for all):

| Variable Name | Data Layer Variable Name |
|---------------|-------------------------|
| `eventCategory` | `eventCategory` |
| `eventAction` | `eventAction` |
| `eventName` | `eventName` |
| `eventValue` | `eventValue` |
| `dimensionId` | `dimensionId` |
| `dimensionName` | `dimensionName` |
| `dimensionValue` | `dimensionValue` |
| `dimensionScope` | `dimensionScope` |
| `pageName` | `pageName` |
| `path` | `path` |
| `conversationId` | `conversationId` |
| `startTime` | `startTime` |
| `userAgent` | `userAgent` |
| `screenResolution` | `screenResolution` |
| `viewport` | `viewport` |

**For each variable:**
- Type: `Data Layer Variable`
- Data Layer Variable Name: (same as Variable Name)
- Default Value: (leave empty)

### 2.3: Create Tags

**Go to Tags → Create New Tag**

#### Tag 1: Matomo Analytics - Pageview

**Basic Configuration:**
- **Tag Name:** `Matomo Analytics - Pageview`
- **Tag Type:** `Matomo Analytics`
- **Tracking Type:** `Pageview`

**Matomo Configuration:**
- **Matomo URL:** Your Matomo URL (e.g., `stats.berkman.harvard.edu`)
- **Site ID:** Your Site ID (e.g., `18`)

**Custom Dimensions:**

If you see a dynamic/table configuration:
```
Dimension ID: {{dimensionId}}
Dimension Value: {{dimensionValue}}
```

Or individual fields:
```
Custom Dimension 1: {{dimensionValue}}
Custom Dimension 2: {{dimensionValue}}
Custom Dimension 3: {{dimensionValue}}
Custom Dimension 4: {{dimensionValue}}
Custom Dimension 5: {{dimensionValue}}
```

**Trigger:**
- Create trigger: `All Pageviews`
- Type: `Custom Event`
- Event Name: `mtm.PageView`

**Optional - Enable Heartbeat Timer:**

To track active time more accurately, you can enable Matomo's built-in heartbeat timer in your Tag Manager container configuration.


#### Tag 2: Matomo Analytics - Events

**Basic Configuration:**
- **Tag Name:** `Matomo Analytics - Events`
- **Tag Type:** `Matomo Analytics`
- **Tracking Type:** `Event`

**Matomo Configuration:**
- **Matomo URL:** Your Matomo URL
- **Site ID:** Your Site ID

**Event Configuration:**
- **Event Category:** `{{eventCategory}}`
- **Event Action:** `{{eventAction}}`
- **Event Name:** `{{eventName}}`
- **Event Value:** `{{eventValue}}`

**Custom Dimensions:** (Same as Pageview tag)

**Trigger:**
- Create trigger: `All Custom Events`
- Type: `Custom Event`
- Event Name: `customEvent`

**Save the tag**

### 2.4: Publish Container

1. Click **Publish** (top right)
2. Version Name: e.g., "Analytics setup"
3. Description: "Added pageview tracking, events, and custom dimensions"
4. Click **Publish Now**

⚠️ **Important:** Changes only go live after publishing!

---

## Step 3: Testing & Verification

### 3.1: Preview Mode Testing

1. **Enable Preview Mode** in MTM
   - Click **Preview / Debug**
   - Enter your website URL (e.g., `http://localhost:8080`)
   - Click **Start Preview**

2. **Open Your Website** in the same browser

3. **Verify Data Layer Tab**
   - Should see events: `mtm.Start`, `mtm.PageView`, `customEvent`
   - Click each event to see properties
   - Verify variables have values

4. **Check Tags Tab**
   - "Matomo Analytics - Pageview" should show **Fired** (green)
   - "Matomo Analytics - Events" should show **Fired** when events trigger

### 3.2: Browser Network Testing

1. **Open DevTools** (F12) → Network tab
2. **Filter by:** "piwik" or "matomo"
3. **Refresh the page**

**Verify Pageview Requests:**
- Should have `action_name=` parameter
- Should have `idsite=18` (your site ID)
- Should have `url=` parameter

**Verify Event Requests:**
- Should have `e_c=` (event category)
- Should have `e_a=` (event action)

**Verify Custom Dimensions:**
- Look for `dimension1=`, `dimension2=`, etc. in request parameters

### 3.3: Matomo Dashboard Testing

1. **Go to Matomo Dashboard**
2. **Select your website**
3. **Check Real-time:**
   - Go to **Visitors → Real-time**
   - You should see your current visit
   - Should show pages and events

4. **Check Custom Dimensions:**
   - Go to **Visitors → Custom Dimensions**
   - Select each dimension (1-5)
   - Should see data appearing

### 3.4: Development Console Verification

When `NEXT_PUBLIC_ENABLE_ANALYTICS=true`:
```
[Analytics] Page view: {event: "mtm.PageView", pageName: "assistant", ...}
[Analytics] Event: {event: "customEvent", eventCategory: "interaction", ...}
```

When `NEXT_PUBLIC_ENABLE_ANALYTICS=false`:
```
[Analytics] Analytics is disabled via NEXT_PUBLIC_ENABLE_ANALYTICS environment variable.
```

---

## Troubleshooting

### Analytics Not Loading

**Symptoms:** No analytics tracking at all

**Solutions:**
1. Check `NEXT_PUBLIC_ENABLE_ANALYTICS` is not set to `"false"`
2. Verify environment variable loaded (restart dev server)
3. Check browser console for errors
4. Verify Matomo script loads in Network tab

### Preview Mode Not Connecting

**Symptoms:** Preview panel doesn't appear

**Solutions:**
- Open site in **same browser** as MTM
- URL must **match exactly** (including http/https, port)
- Try **disabling ad blockers**
- Try **incognito/private mode**

### Tags Not Firing

**Symptoms:** Tags show "Not Fired" in preview

**Check:**
- Is **trigger configured correctly**?
- Is **event name** spelled correctly? (case-sensitive)
- Are **data layer events** appearing in Data Layer tab?
- Verify **trigger conditions**

### Variables Show "undefined"

**Symptoms:** Variables show as undefined in preview

**Solutions:**
- Variable name must **match exactly** what code pushes
- Check **Data Layer tab** to see actual event structure
- Verify **case sensitivity** (eventCategory ≠ eventcategory)

### No Data in Matomo Reports

**Symptoms:** Preview works but no data in reports

**Check:**
- Is **Site ID correct** in tags?
- Is **Matomo URL correct**?
- Check **Network tab** - are requests reaching Matomo? (200 status)
- Wait **5-10 minutes** - data processing can be delayed
- Check **Visitor Log** instead of Real-time

### Custom Dimensions Not Appearing

**Symptoms:** Events tracked but dimensions missing

**Solutions:**
- Verify **custom dimensions created in Matomo**
- Check **dimension indices match** (1-5)
- Ensure dimensions are **Active** in Matomo
- Verify **dimension configuration in tags**
- Check if `dimensionId` and `dimensionValue` variables have values

### Container Not Publishing

**Symptoms:** Can't publish or changes not live

**Solutions:**
- Check for **validation errors** (red indicators)
- Ensure all **required fields** filled
- Try **Preview** first to find issues
- Contact Matomo admin if permissions issue

---

## Event Categories Reference

The application tracks these event categories:

### Session Events
- **Category:** `session`
- **Actions:** `start`, `end`, `location_detected`

### Engagement Events
- **Category:** `engagement`
- **Actions:** `visibility_change`, `welcome_dismissed`

### Interaction Events
- **Category:** `interaction`
- **Actions:** `message_sent`, `feedback_sent`, `quick_response_sent`, `custom_message_sent`, `metrics_clicked`

### Feature Usage Events
- **Category:** `feature`
- **Actions:** `open`, `close`, `use`

### System Events
- **Category:** `system`
- **Actions:** `connection_status`

---

## Event Reference: Graph and Artifact Events

Events from the artifact pages (the concept graph and the artifact chrome around it) are sent through `trackArtifactEvent` in `utils/artifactAnalytics.ts`. When a conversation id is available the event carries it on custom dimension 6, like every other event on the site; a series (topic) page or the preview page has no single conversation, so its events go out without one.

| Category | Action | Name | Value |
|---|---|---|---|
| `graph` | `select` | `concept:<analyticsId>`, `prompt:<analyticsId>` or `contribution` (node kind, plus the node's analytics id where it has one) | none |
| `graph` | `hover` | `concept:<analyticsId>` or `prompt:<analyticsId>` (node kind, plus the node's analytics id), after the pointer or focus stays 500ms | none |
| `graph` | `view` | `sky`, `orbit` or `list` | none |
| `graph` | `filter` | `full_series` or `session` | session number, from 1 (`session` only) |
| `graph` | `deselect` | `toggle`, `panel`, `escape` or `empty_sky` | none |
| `graph` | `feedback_rating` | `No`, `Meh`, `OK` or `WOW!` | none |
| `graph` | `feedback_text` | `submitted` | text length |
| `artifact` | `history_open`, `history_close` | artifact type | none |
| `artifact` | `version_select` | `earlier` or `latest` | version number |
| `artifact` | `generate_graph` | `generate` or `regenerate` | none |
| `artifact` | `generate_graph_result` | `generated`, `nothing_written` or `error` | none |
| `artifact` | `share_link` | `copied`, `copy_failed` or `error` | none |
| `artifact` | `passcode_submit` | `success` or `failure` | none |

Notes:
- `hover` fires once per continuous hover, not on every mouseover; leaving the node before 500ms sends nothing. Contributions are never reported on hover.
- `select` and `hover` name a concept or prompt `<kind>:<analyticsId>`, for example `concept:3f9a1c07b2d84e65`. `analyticsId` is an opaque string the backend adds to each concept and origin prompt: the first 16 hex characters of an HMAC of the node id, keyed with a server secret (`ANALYTICS_ID_SECRET`). It reveals nothing about the discussion and cannot be reversed by guessing text. Without that secret the backend omits it, and the name is the bare kind (`concept` or `prompt`). A contribution is always the bare kind `contribution`, never an id.
- The node id itself is never sent: the backend derives concept and prompt ids from their text, which comes out of the discussion, and a contribution id points at one person's account.
- Stability: an `analyticsId` follows the backend's slug id, so it changes when that id does, for example after an alias merge or a label rename. A concept's trend can therefore have gaps or split across two ids. Reports map ids back to labels server-side only; the labels are never sent to analytics.

### Privacy rules

These graphs come from events held under the Chatham House Rule, so:
- Never send a passcode as an event name or value. A passcode that arrives in the URL reports nothing, and `passcode_submit` carries only the outcome.
- Never send free text a reader typed. Feedback text reports `submitted` with its length as the value.
- Never send participant or quote content, a pseudonym, a message id, or a node id or label (anything derived from what was said) as an event name. Use a fixed, enumerable name such as a view name, or a node kind with its opaque `analyticsId` (never the node id).

---

## Configuration Checklist

Use this to verify complete setup:

### Matomo Configuration
- [ ] 5 Custom dimensions created
- [ ] Dimension indices are 1-5
- [ ] All dimensions Active
- [ ] Site ID correct

### MTM Configuration
- [ ] 15 Data Layer Variables created
- [ ] All variable names correct (case-sensitive)
- [ ] Pageview tag created
- [ ] Events tag created
- [ ] Custom dimensions configured in tags
- [ ] Triggers created correctly
- [ ] Container published

### Testing
- [ ] Preview mode connects successfully
- [ ] Data Layer events appear
- [ ] Tags fire correctly
- [ ] Network requests successful
- [ ] Real-time shows activity
- [ ] Custom dimensions show data

---

## Environment-Specific Setup

When setting up multiple environments (dev, staging, production):

**What Changes:**
- Matomo URL (may differ)
- Site ID (usually different)
- Container ID (may be different)

**What Stays the Same:**
- Variable names
- Tag configuration
- Trigger configuration
- Data layer structure

**Recommendation:**
- Create **separate MTM containers** per environment
- Use **same configuration** across environments
- Only change Matomo URL and Site ID
- Document which container goes with which environment

---

## Support Resources

- **Implementation Details:** See `ANALYTICS_REFERENCE.md`
- **Matomo Documentation:** https://matomo.org/docs/
- **MTM Documentation:** https://matomo.org/docs/tag-manager/

---

*Last updated: 2026-01-09*
