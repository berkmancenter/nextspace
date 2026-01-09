# Analytics Reference Guide

Developer reference for NextSpace analytics implementation.

**Table of Contents:**
- [Architecture Overview](#architecture-overview)
- [Implementation Details](#implementation-details)
- [Tracked Metrics](#tracked-metrics)
- [Location Detection](#location-detection)
- [Privacy & Compliance](#privacy--compliance)

---

## Architecture Overview

### Core Components

```
pages/_document.tsx     → Loads Matomo script (conditional)
utils/analytics.ts      → Core tracking functions
hooks/useAnalytics.ts   → React hooks for page tracking
pages/_app.tsx          → Global session tracking
pages/*.tsx             → Page-specific tracking
```

### Data Flow

```
User Action
    ↓
React Component calls tracking function
    ↓
utils/analytics.ts validates and formats data
    ↓
Pushes to window._mtm data layer
    ↓
Matomo Tag Manager processes event
    ↓
Data sent to Matomo instance
```

---

## Implementation Details

### Core Tracking Functions

All functions are in `utils/analytics.ts`:

#### Page Tracking

```typescript
trackPageView(pageName: string, customData?: Record<string, any>): void
```
- Tracks page views with optional custom data
- Automatically called by `useAnalytics()` hook
- Includes page name and any additional context

#### Event Tracking

```typescript
trackEvent(
  category: string,
  action: string,
  name?: string,
  value?: number
): void
```
- Tracks custom events (user interactions, feature usage)
- Category: high-level grouping (session, engagement, interaction, feature, system)
- Action: specific action taken
- Name: optional additional context
- Value: optional numeric value

#### Custom Dimensions

```typescript
setCustomDimension(
  index: number,
  name: string,
  value: string,
  scope: 'visit' | 'action' = 'visit'
): void
```
- Sets custom dimensions for enriched tracking
- Index: 1-5 (must match Matomo configuration)
- Scope: 'visit' (session-level) or 'action' (page-level)

#### Session Management

```typescript
trackSessionStart(metadata?: Record<string, any>): void
trackSessionEnd(durationSeconds: number): void
```
- Tracks session lifecycle
- Captures session metadata (start time, device info)
- Calculates total session duration

#### Specialized Tracking

```typescript
trackHeartbeat(): void
trackVisibilityChange(visible: boolean): void
trackConnectionStatus(status: 'connected' | 'disconnected' | 'error'): void
trackFeatureUsage(feature: string, action: 'open' | 'close' | 'use', durationSeconds?: number): void
trackUserLocation(location: 'local' | 'remote', method: 'ip' | 'url' | 'default'): void
```

### React Hooks

#### useAnalytics()

```typescript
// In any page component
import { useAnalytics } from '@/hooks/useAnalytics';

function MyPage() {
  useAnalytics('pageName');
  // Automatically tracks:
  // - Page view on mount
  // - Heartbeat every 60s while visible
  // - Page duration on unmount
  // - Visibility changes
}
```

#### useSessionTracking()

```typescript
// In _app.tsx only
import { useSessionTracking } from '@/hooks/useAnalytics';

function MyApp({ Component, pageProps }) {
  useSessionTracking();
  // Automatically tracks:
  // - Session start
  // - Session end with duration
  // - Device information
}
```

### Page-Specific Implementations

#### Home Page (pages/index.tsx)
```typescript
useAnalytics('home');
```
- Basic page view tracking
- Page duration measurement

#### Assistant Page (pages/assistant.tsx)
```typescript
useAnalytics('assistant');

// Track message sends
trackEvent('interaction', 'message_sent', 'assistant_question');

// Track feedback
trackEvent('interaction', 'feedback_sent', feedbackType, rating);

// Track user ID
setUserId(pseudonym.value);
```

#### Moderator Page (pages/moderator.tsx)
```typescript
useAnalytics('moderator');

// Track transcript toggle
trackFeatureUsage('transcript', 'open');
trackFeatureUsage('transcript', 'close', durationSeconds);

// Track metrics clicks
trackEvent('interaction', 'metrics_clicked');
```

#### Backchannel Page (pages/backchannel.tsx)
```typescript
useAnalytics('backchannel');

// Track welcome dismissal
trackEvent('engagement', 'welcome_dismissed');

// Track quick responses
trackEvent('interaction', 'quick_response_sent', buttonLabel);

// Track custom messages
trackEvent('interaction', 'custom_message_sent');

// Track user ID
setUserId(pseudonym.value);
```

---

## Tracked Metrics

### Session Metrics

**What's Tracked:**
- Session start timestamp (ISO format)
- Session end timestamp
- Total session duration (seconds)
- Active time via heartbeat (60s intervals)
- Page visibility changes

**Use Cases:**
- Average session length
- Active vs idle time
- Session frequency patterns
- Time-of-day usage

**Custom Dimensions Used:**
- Index 1: `session_start_time` (Visit scope)
- Index 5: `session_duration` (Visit scope)

### Page Metrics

**What's Tracked:**
- Page views with page name
- Page type (home, assistant, moderator, backchannel)
- Time spent per page
- Navigation patterns

**Use Cases:**
- Most visited pages
- Average time per page
- Navigation flow analysis
- Page engagement

**Custom Dimensions Used:**
- Index 3: `page_type` (Action scope)
- Index 4: `page_duration` (Action scope)

### User Behavior

**What's Tracked:**
- User location (local venue vs remote)
- Device information (user agent, screen, viewport)
- Feature usage (transcript toggle, message sending)
- Interaction patterns

**Use Cases:**
- Local vs remote user comparison
- Device type distribution (mobile vs desktop)
- Feature adoption rates
- User journey mapping

**Custom Dimensions Used:**
- Index 2: `user_location` (Visit scope)

### Interaction Events

**Categories Tracked:**

| Category | Actions | Purpose |
|----------|---------|---------|
| `session` | start, end, location_detected | Session lifecycle |
| `engagement` | heartbeat, visibility_change, welcome_dismissed | Active time |
| `interaction` | message_sent, feedback_sent, quick_response_sent, custom_message_sent, metrics_clicked | User actions |
| `feature` | open, close, use | Feature usage |
| `system` | connection_status | Technical health |

### Technical Metrics

**What's Tracked:**
- Connection status (connected, disconnected, error)
- Error events (if implemented)
- System health indicators

**Use Cases:**
- Connection stability monitoring
- Error rate tracking
- Performance analysis

---

## Location Detection

### Overview

Privacy-preserving mechanism to detect if users are at the venue (local) or accessing remotely.

### Detection Methods (Priority Order)

1. **URL Parameter Override** (highest priority)
   ```
   https://app.com/assistant?location=local
   ```
   - Manual override for guaranteed detection
   - Useful for event links

2. **IP Range Matching**
   - Checks if user's IP falls within configured ranges
   - Configured via `LOCAL_IP_RANGES` environment variable
   - Uses CIDR notation

3. **Default to Remote** (fallback)
   - Privacy-preserving default
   - Applied when no match found

### Configuration

**Environment Variable:**

```bash
# .env file
LOCAL_IP_RANGES=10.0.0.0/8,192.168.1.0/24,172.16.50.0/24
```

**Example Configurations:**

```bash
# University/Venue WiFi
LOCAL_IP_RANGES=192.168.1.0/24,10.20.0.0/16

# Multiple locations
LOCAL_IP_RANGES=192.168.1.0/24,192.168.2.0/24,10.0.0.0/8

# Localhost for testing
LOCAL_IP_RANGES=127.0.0.0/8
```

### Implementation

**API Endpoint:** `pages/api/check-location.ts`
- Receives client request
- Extracts IP from headers
- Checks against configured ranges
- Returns boolean result only

**Utility:** `utils/ipRangeChecker.ts`
- CIDR parsing and validation
- IP range matching logic
- Error handling

**Hook Integration:** `hooks/useAnalytics.ts`
- Calls API on page load
- Tracks result with `trackUserLocation()`
- Handles errors gracefully

### Privacy Guarantees

✅ **What We Track:**
- Boolean result only: "local" or "remote"
- Detection method used: "ip", "url", or "default"

❌ **What We DON'T Track:**
- IP addresses
- Precise location
- Network identifiers
- Any PII

**Data Sent to Matomo:**
```javascript
{
  dimensionId: 2,
  dimensionName: 'user_location',
  dimensionValue: 'local', // or 'remote'
  dimensionScope: 'visit'
}
```

### Use Cases

**Event Planning:**
- Track in-venue vs online attendance
- Compare engagement patterns
- Optimize hybrid event experiences

**Feature Testing:**
- A/B test venue-specific features
- Analyze location-based usage patterns

**Manual Override:**
```
# For in-venue QR codes or event emails
https://app.com/backchannel?conversationId=123&location=local
```

---

## Privacy & Compliance

### Data Collection Principles

✅ **What We Do:**
- Use pseudonymous identifiers (no real names)
- Track interaction counts, not content
- Aggregate metrics only
- Privacy-preserving defaults

❌ **What We Don't Do:**
- Track message content
- Store IP addresses
- Collect PII
- Track without user's knowledge

### GDPR Considerations

**Lawful Basis:** Legitimate interest for service improvement

**User Rights:**
- Right to disable tracking (via environment variable)
- Right to access data (via Matomo)
- Right to deletion (via Matomo)

**Data Minimization:**
- Only collect necessary metrics
- Pseudonymous identifiers
- No sensitive data

### Matomo Privacy Features

- IP anonymization (configurable in Matomo)
- Cookie consent integration (can be added)
- Data retention policies (configurable)
- GDPR compliance mode available

### Disabling Tracking

**Deployment-Level:**
```bash
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

**Effects:**
- No script loading
- No tracking execution
- No network requests
- Application continues normally

---

## Code Structure

### File Organization

```
pages/
  _document.tsx          # Conditional script loading
  _app.tsx               # Global session tracking
  [page].tsx             # Page-specific tracking

utils/
  analytics.ts           # Core tracking functions

hooks/
  useAnalytics.ts        # React hooks for tracking

.env.template            # Environment configuration
```

### Key Functions

**Analytics Utility (`utils/analytics.ts`):**
- `isAnalyticsEnabled()` - Check if analytics is enabled
- `isMatomoLoaded()` - Check if Matomo script loaded
- `ensureMTM()` - Initialize data layer safely
- All tracking functions listed above

**React Hooks (`hooks/useAnalytics.ts`):**
- `useAnalytics(pageName)` - Page-level tracking
- `useSessionTracking()` - Global session tracking

### Environment Variables

```bash
# Required for disabling analytics
NEXT_PUBLIC_ENABLE_ANALYTICS=true|false

# Optional for location detection
LOCAL_IP_RANGES=comma,separated,cidr,ranges
```

---

## Development Guidelines

### Adding New Tracking

1. **Identify the metric** you want to track
2. **Choose appropriate function:**
   - Page view? Use `trackPageView()`
   - User interaction? Use `trackEvent()`
   - Session data? Use `setCustomDimension()`
3. **Select event category** (session, engagement, interaction, feature, system)
4. **Add tracking code** at appropriate location
5. **Test in development** (check console logs)
6. **Verify in Matomo** (preview mode and real-time)

### Testing Checklist

- [ ] Check console logs in development
- [ ] Verify data layer in MTM preview mode
- [ ] Confirm network requests in DevTools
- [ ] Check Matomo real-time dashboard
- [ ] Verify custom dimensions appear
- [ ] Test with analytics disabled
- [ ] Test with analytics enabled

### Best Practices

✅ **Do:**
- Use descriptive event names
- Be consistent with naming conventions
- Test thoroughly before deploying
- Document new tracking added

❌ **Don't:**
- Track sensitive information
- Track message content
- Block app functionality for tracking
- Assume tracking succeeded without verification

---

## Maintenance

### When Code Changes

Update analytics when:
- Adding new pages (add `useAnalytics()` hook)
- Adding new features (add tracking for usage)
- Changing user flows (update page tracking)
- Adding new event types (document here)

### When Matomo Changes

Update if:
- Custom dimension indices change (update code)
- New dimensions added (update tags)
- Site ID changes (update MTM tags)
- Matomo URL changes (update MTM tags)

### Monitoring

Regular checks:
- Review Matomo dashboard weekly
- Check for tracking errors in logs
- Verify all events still firing
- Monitor data quality

---

## Support Resources

- **Setup Guide:** `ANALYTICS_SETUP.md`
- **Code:** `utils/analytics.ts`, `hooks/useAnalytics.ts`
- **Matomo Docs:** https://matomo.org/docs/
- **MTM Docs:** https://matomo.org/docs/tag-manager/

---

*Last updated: 2026-01-09*