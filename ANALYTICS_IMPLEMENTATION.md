# Analytics Implementation Summary

## Overview

Matomo Tag Manager analytics has been successfully implemented across the NextSpace application to track user behavior, session metrics, and feature usage.

## What Was Implemented

### Core Infrastructure

1. **Analytics Utility** (`utils/analytics.ts`)
   - Core tracking functions for events, page views, and custom dimensions
   - Session management (start/end tracking)
   - Heartbeat mechanism for active time tracking
   - Connection status tracking
   - Feature usage tracking

2. **Analytics Hooks** (`hooks/useAnalytics.ts`)
   - `useAnalytics()` - Automatic page-level tracking with heartbeat
   - `useSessionTracking()` - Global session tracking
   - Visibility API integration for accurate active time measurement
   - Automatic cleanup on component unmount

3. **Global Session Tracking** (`pages/_app.tsx`)
   - Application-wide session initialization
   - Tracks session start/end with duration
   - Captures device information (user agent, screen resolution, viewport)

### Page-Specific Tracking

#### Home Page (`pages/index.tsx`)
- Basic page view tracking
- Page duration measurement

#### Backchannel Page (`pages/backchannel.tsx`)
- Welcome screen dismissal tracking
- Quick response button clicks (with button label)
- Custom message sends
- Connection status monitoring
- User ID (pseudonym) tracking

#### Moderator Page (`pages/moderator.tsx`)
- Transcript toggle tracking (open/close with duration)
- Metrics click-through to transcript
- Connection status monitoring
- Page engagement tracking

#### Assistant Page (`pages/assistant.tsx`)
- Message sends to event assistant
- Feedback submission tracking
- Controlled mode (feedback) usage
- Connection status monitoring
- User ID (pseudonym) tracking

## Key Features

### Session Tracking
- Tracks total session duration from app open to close
- Measures active time vs total time using Page Visibility API
- Sends heartbeat every 60 seconds while page is visible
- Captures session metadata (start time, device info)

### Page Navigation
- Automatic page view tracking on route changes
- Tracks time spent on each page
- Records page type for analytics segmentation

### User Interactions
- Message sending (quick responses vs custom messages)
- Feature usage (transcript toggle, feedback submission)
- Button clicks and form interactions
- Connection events (connected, disconnected, error)

### Privacy & Best Practices
- Uses pseudonymized user IDs
- Does not track message content, only counts
- Follows Matomo Tag Manager best practices
- Non-blocking, asynchronous tracking
- Graceful error handling

## Tracked Metrics

### Answers to Your Questions

1. **How long do users have the app open?**
   - Session duration tracked via `trackSessionStart()` and `trackSessionEnd()`
   - Active time measured via heartbeat events every 60s
   - Available in custom dimension "session_duration"

2. **What tab is the user on?**
   - Page views tracked automatically on navigation
   - Page duration tracked for each page visit
   - Available via "page_type" custom dimension

3. **What types of users do we see?**
   - Session frequency and patterns via session events
   - Time of day via session start timestamps
   - Usage frequency via returning visitor tracking
   - Engagement patterns via heartbeat and visibility events

4. **Mobile versus desktop usage?**
   - Automatically tracked by Matomo based on user agent
   - Enhanced with custom viewport and screen resolution data

5. **Transcript view measurement?**
   - ✅ YES - Transcript toggle tracking implemented
   - Tracks open/close events
   - Measures duration transcript was open
   - Available via "feature" category events

## Event Structure

All events follow this consistent pattern:

```javascript
trackEvent(category, action, name?, value?)
```

### Event Categories
- `session` - Session lifecycle events
- `engagement` - Active time and user engagement
- `interaction` - User interactions with features
- `feature` - Feature-specific usage
- `system` - Technical system events

## Custom Dimensions

1. **session_start_time** (Visit scope) - ISO timestamp
2. **page_type** (Action scope) - home, assistant, moderator, backchannel
3. **session_duration** (Visit scope) - Total duration in seconds
4. **page_duration** (Action scope) - Time on page in seconds
5. **user_location** (Visit scope) - "local" (at venue) or "remote"

## Next Steps

### Testing & Validation
1. Run the application in development mode
2. Open browser developer tools console
3. Look for `[Analytics]` log messages
4. Verify events are being tracked
5. Check Matomo Real-time view for incoming data

### Matomo Configuration
1. Follow the setup guide in [MATOMO_SETUP.md](./MATOMO_SETUP.md)
2. Configure custom dimensions in Matomo
3. Verify dimension indices match the implementation
4. Test end-to-end data flow

### Monitoring
- Check Matomo regularly for data quality
- Monitor for missing events or errors
- Review user behavior patterns
- Adjust tracking as needed based on insights

## Files Modified/Created

### New Files
- `utils/analytics.ts` - Core analytics utility
- `hooks/useAnalytics.ts` - React hooks for analytics
- `docs/MATOMO_SETUP.md` - Matomo configuration guide
- `docs/ANALYTICS_IMPLEMENTATION.md` - This file

### Modified Files
- `pages/_app.tsx` - Added session tracking
- `pages/index.tsx` - Added page tracking
- `pages/backchannel.tsx` - Added interaction tracking
- `pages/moderator.tsx` - Added feature and interaction tracking
- `pages/assistant.tsx` - Added message and feedback tracking

## Compliance & Privacy

The implementation:
- ✅ Uses pseudonymous identifiers
- ✅ Does not track sensitive message content
- ✅ Respects user privacy
- ✅ Follows GDPR-friendly practices
- ✅ Can be extended with consent management if needed

## Support & Documentation

- **Setup Guide**: See [MATOMO_SETUP.md](./MATOMO_SETUP.md)
- **Code Reference**: Check `utils/analytics.ts` and `hooks/useAnalytics.ts`
- **Matomo Docs**: https://matomo.org/docs/
- **MTM Best Practices**: https://matomo.org/docs/tag-manager/

## Location Detection (Local vs Remote)

The application includes privacy-preserving location detection to determine if users are accessing from the venue (local) or remotely.

### How It Works

**Detection Priority:**
1. **URL Parameter** - Manual override via `?location=local` in URL
2. **IP Range Matching** - Automatic detection based on configured IP ranges
3. **Default to Remote** - Privacy-preserving default if no match

### Configuration

Set the `LOCAL_IP_RANGES` environment variable with comma-separated CIDR ranges:

```bash
LOCAL_IP_RANGES=10.0.0.0/8,192.168.1.0/24,172.16.50.0/24
```

### Privacy Guarantees

- ✅ Only boolean result ("local" or "remote") sent to Matomo
- ✅ No IP addresses logged or stored
- ✅ No IP addresses sent to analytics
- ✅ Defaults to "remote" on error (privacy-preserving)

### Implementation Files

- `pages/api/check-location.ts` - API endpoint for detection
- `utils/ipRangeChecker.ts` - IP range matching utility
- `hooks/useAnalytics.ts` - Frontend integration
- `utils/analytics.ts` - `trackUserLocation()` function

### Usage Examples

**Venue WiFi:**
```bash
# Configure venue IP ranges
LOCAL_IP_RANGES=192.168.1.0/24,10.20.0.0/16
```

**Manual Override:**
```
# Add to event links for guaranteed local detection
https://yourapp.com/backchannel?conversationId=123&location=local
```

## Future Enhancements (Not Yet Implemented)

These were discussed but not yet implemented:
- Advanced device fingerprinting
- Detailed viewport/orientation tracking
- Mouse/touch heatmaps
- Form field analytics
