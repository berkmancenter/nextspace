# Matomo Tag Manager Analytics Setup Guide

This guide explains how to configure Matomo to receive and process the analytics data from the NextSpace application.

## Overview

The NextSpace application uses Matomo Tag Manager (MTM) to track:
- Session duration and active time
- Page navigation and engagement
- User behavior patterns
- Feature usage (transcript toggle, message sending, etc.)
- Connection status
- Device type (mobile vs desktop)

## Custom Dimensions Configuration

You need to configure the following custom dimensions in your Matomo instance:

### Visit-Scoped Dimensions

These dimensions persist for the entire user session:

1. **Session Start Time** (Index: 1)
   - **Name**: `session_start_time`
   - **Scope**: Visit
   - **Description**: ISO timestamp when the session started

2. **Page Type** (Index: 2)
   - **Name**: `page_type`
   - **Scope**: Visit
   - **Description**: Type of page (home, assistant, moderator, backchannel)

3. **Session Duration** (Index: 3)
   - **Name**: `session_duration`
   - **Scope**: Visit
   - **Description**: Total session duration in seconds

### Action-Scoped Dimensions

These dimensions are specific to individual actions/page views:

4. **Page Duration** (Index: 4)
   - **Name**: `page_duration`
   - **Scope**: Action
   - **Description**: Time spent on a specific page in seconds

## Setting Up Custom Dimensions in Matomo

1. Log in to your Matomo instance
2. Go to **Administration** → **Custom Dimensions**
3. Click **Add a new dimension**
4. For each dimension listed above:
   - Enter the **Name** exactly as specified
   - Select the appropriate **Scope** (Visit or Action)
   - Add the **Description**
   - Note the auto-assigned index number (should match the numbers above)
   - Click **Create New Dimension**

## Event Categories

The application tracks the following event categories:

### Session Events
- **Category**: `session`
- **Actions**: `start`, `end`
- **Purpose**: Track when users start and end sessions

### Engagement Events
- **Category**: `engagement`
- **Actions**: `heartbeat`, `visibility_change`, `welcome_dismissed`
- **Purpose**: Track active time and engagement patterns

### Interaction Events
- **Category**: `interaction`
- **Actions**:
  - `quick_response_sent` (backchannel)
  - `custom_message_sent` (backchannel)
  - `message_sent` (assistant)
  - `feedback_sent` (assistant)
  - `metrics_clicked` (moderator)
- **Purpose**: Track user interactions with features

### Feature Usage Events
- **Category**: `feature`
- **Actions**: `open`, `close`, `use`
- **Purpose**: Track feature usage (e.g., transcript toggle)

### System Events
- **Category**: `system`
- **Actions**: `connection_status`
- **Purpose**: Track technical system status

## Key Metrics Available

Once configured, you'll be able to analyze:

1. **Session Metrics**
   - Average session duration
   - Active vs. idle time
   - Session frequency per user

2. **Page Metrics**
   - Time spent on each page type
   - Page navigation patterns
   - Most visited pages

3. **User Behavior**
   - When users open the app (time of day/week)
   - Usage frequency
   - Feature adoption rates

4. **Feature Usage**
   - Transcript toggle usage and duration
   - Message sending frequency
   - Quick response vs custom messages
   - Feedback submission rates

5. **Technical Metrics**
   - Connection stability
   - Error rates
   - Device type distribution

## Verifying Your Setup

After implementing the tracking code and configuring Matomo:

1. Open your NextSpace application
2. Navigate through different pages
3. Interact with features (send messages, toggle transcript, etc.)
4. In Matomo, go to **Visitors** → **Real-time**
5. Verify you see events being tracked
6. Check **Visitors** → **Custom Dimensions** to see dimension data

## Data Layer Variables

The application pushes data to `window._mtm` using these formats:

### Page View
```javascript
{
  event: 'mtm.PageView',
  pageName: 'assistant',
  path: '/assistant?conversationId=123'
}
```

### Custom Event
```javascript
{
  event: 'customEvent',
  eventCategory: 'interaction',
  eventAction: 'message_sent',
  eventName: 'assistant_question',
  eventValue: 1
}
```

### Custom Dimension
```javascript
{
  event: 'customDimension',
  dimensionId: 2,
  dimensionName: 'page_type',
  dimensionValue: 'backchannel',
  dimensionScope: 'visit'
}
```

## Privacy Considerations

The implementation respects user privacy:
- User IDs are pseudonymized
- Conversation IDs can be anonymized if needed
- No sensitive message content is tracked
- Only counts and metadata are captured

## Troubleshooting

### Events Not Appearing in Matomo

1. Check browser console for errors
2. Verify MTM container is loading correctly
3. Ensure `window._mtm` is defined
4. Check Network tab for MTM requests

### Custom Dimensions Not Working

1. Verify dimension indices match in code and Matomo
2. Ensure dimensions are activated in Matomo
3. Check dimension scope (Visit vs Action)
4. Clear browser cache and test again

### Missing Data

1. Verify all pages have analytics hooks initialized
2. Check that events are being triggered
3. Look for JavaScript errors in console
4. Ensure MTM container is published and live

## Support

For issues with:
- **Matomo Configuration**: Refer to [Matomo Documentation](https://matomo.org/docs/)
- **Implementation**: Check the source code in `utils/analytics.ts` and `hooks/useAnalytics.ts`
- **Custom Dimensions**: See [Matomo Custom Dimensions Guide](https://matomo.org/docs/custom-dimensions/)