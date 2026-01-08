# Matomo Tag Manager (MTM) Configuration Guide

This guide provides step-by-step instructions for configuring Matomo Tag Manager to work with the NextSpace analytics implementation.

**⚠️ CRITICAL:** The analytics code will not function without proper MTM configuration. This guide must be followed for each environment (development, staging, production).

## Prerequisites

Before starting, ensure you have:

- [ ] Access to Matomo Tag Manager interface
- [ ] Admin rights to create tags, triggers, and variables
- [ ] Your Matomo instance URL (e.g., `stats.berkman.harvard.edu`)
- [ ] Your Site ID from Matomo (e.g., `18`)
- [ ] MTM Container ID (visible in the tracking code)

## Configuration Overview

The complete setup requires:
1. **15 Data Layer Variables** - Define what data is available
2. **5 Custom Dimensions** - Configure in Matomo (see MATOMO_SETUP.md)
3. **2-3 Tags** - Define how to send data to Matomo
4. **2-3 Triggers** - Define when to send data
5. **Publish Container** - Activate the configuration

**Estimated time:** 45-60 minutes for first-time setup

---

## Step 1: Create Data Layer Variables

Data Layer Variables tell MTM which properties from your code's data layer to use in tags.

### Access Variables

1. Log into **Matomo Tag Manager**
2. Select your **Container**
3. Go to **Variables** (left sidebar)
4. Click **"Create New Variable"** for each variable below

### Variables to Create

For each variable, use these settings:

#### Variable 1: eventCategory

- **Name:** `eventCategory`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `eventCategory`
- **Default Value:** (leave empty)

#### Variable 2: eventAction

- **Name:** `eventAction`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `eventAction`
- **Default Value:** (leave empty)

#### Variable 3: eventName

- **Name:** `eventName`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `eventName`
- **Default Value:** (leave empty)

#### Variable 4: eventValue

- **Name:** `eventValue`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `eventValue`
- **Default Value:** (leave empty)

#### Variable 5: dimensionId

- **Name:** `dimensionId`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `dimensionId`
- **Default Value:** (leave empty)

#### Variable 6: dimensionName

- **Name:** `dimensionName`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `dimensionName`
- **Default Value:** (leave empty)

#### Variable 7: dimensionValue

- **Name:** `dimensionValue`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `dimensionValue`
- **Default Value:** (leave empty)

#### Variable 8: dimensionScope

- **Name:** `dimensionScope`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `dimensionScope`
- **Default Value:** (leave empty)

#### Variable 9: pageName

- **Name:** `pageName`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `pageName`
- **Default Value:** (leave empty)

#### Variable 10: path

- **Name:** `path`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `path`
- **Default Value:** (leave empty)

#### Variable 11: conversationId

- **Name:** `conversationId`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `conversationId`
- **Default Value:** (leave empty)

#### Variable 12: startTime

- **Name:** `startTime`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `startTime`
- **Default Value:** (leave empty)

#### Variable 13: userAgent

- **Name:** `userAgent`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `userAgent`
- **Default Value:** (leave empty)

#### Variable 14: screenResolution

- **Name:** `screenResolution`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `screenResolution`
- **Default Value:** (leave empty)

#### Variable 15: viewport

- **Name:** `viewport`
- **Type:** `Data Layer Variable`
- **Data Layer Variable Name:** `viewport`
- **Default Value:** (leave empty)

### Verification

After creating all variables, you should see 15 Data Layer Variables in your Variables list.

---

## Step 2: Configure Custom Dimensions in Matomo

**Note:** This step is documented in detail in `MATOMO_SETUP.md`.

**Quick reference:** You need to create 5 custom dimensions in Matomo (not MTM):

1. **session_start_time** (Index 1, Visit scope)
2. **user_location** (Index 2, Visit scope)
3. **page_type** (Index 3, Action scope)
4. **page_duration** (Index 4, Action scope)
5. **session_duration** (Index 5, Visit scope)

**→ See MATOMO_SETUP.md for detailed instructions**

---

## Step 3: Create Tags

Tags define HOW and WHAT data to send to Matomo.

### Access Tags

1. In MTM, go to **Tags** (left sidebar)
2. Click **"Create New Tag"**

### Tag 1: Matomo Analytics - Pageview

**Purpose:** Track page views

#### Basic Configuration

- **Tag Name:** `Matomo Analytics - Pageview`
- **Tag Type:** `Matomo Analytics` (or your Matomo tag type)
- **Tracking Type:** Select **`Pageview`**

#### Matomo Configuration

- **Matomo URL:** `stats.berkman.harvard.edu` (or your Matomo URL)
- **Site ID:** `18` (or your site ID)

#### Custom Dimensions Configuration

**If you see a "Custom Dimensions" section:**

Use **Dynamic/Table** configuration:

| Dimension ID | Dimension Value |
|--------------|-----------------|
| `{{dimensionId}}` | `{{dimensionValue}}` |

**Or if you see individual dimension fields:**

```
Custom Dimension 1: {{dimensionValue}}
Custom Dimension 2: {{dimensionValue}}
Custom Dimension 3: {{dimensionValue}}
Custom Dimension 4: {{dimensionValue}}
Custom Dimension 5: {{dimensionValue}}
```

#### Trigger Configuration

Click **"Add Trigger"** and create a new trigger:

- **Trigger Name:** `All Pageviews`
- **Trigger Type:** `Page View` (or `Custom Event`)
- **Event Name:** `mtm.PageView` (if using Custom Event type)
- **Fire On:** `All Page Views`

**Save the tag**

---

### Tag 2: Matomo Analytics - Events

**Purpose:** Track custom events (interactions, engagement, system events)

#### Basic Configuration

- **Tag Name:** `Matomo Analytics - Events`
- **Tag Type:** `Matomo Analytics`
- **Tracking Type:** Select **`Event`**

#### Matomo Configuration

- **Matomo URL:** `stats.berkman.harvard.edu`
- **Site ID:** `18`

#### Event Configuration

Map your data layer variables to event parameters:

- **Event Category:** `{{eventCategory}}`
- **Event Action:** `{{eventAction}}`
- **Event Name:** `{{eventName}}`
- **Event Value:** `{{eventValue}}`

#### Custom Dimensions Configuration

**Same as Pageview tag** - add custom dimensions:

| Dimension ID | Dimension Value |
|--------------|-----------------|
| `{{dimensionId}}` | `{{dimensionValue}}` |

#### Trigger Configuration

Click **"Add Trigger"** and create a new trigger:

- **Trigger Name:** `All Custom Events`
- **Trigger Type:** `Custom Event`
- **Event Name:** `customEvent`
- **Fire On:** `All Custom Events`

**Save the tag**

---

### Tag 3: Custom Dimensions (Optional - if not configured in tags above)

**Only create this if your Matomo Analytics tags DON'T support custom dimensions.**

If you successfully configured custom dimensions in Tags 1 & 2, **skip this tag**.

#### When You Need This

- Your tag type doesn't have custom dimensions section
- Dimensions aren't being sent despite configuration

#### Configuration (if needed)

- **Tag Name:** `Matomo - Set Custom Dimension`
- **Tag Type:** `Custom HTML`
- **HTML:**

```html
<script>
(function() {
  var _paq = window._paq || [];
  var dimId = {{dimensionId}};
  var dimValue = {{dimensionValue}};

  if (dimId && dimValue) {
    _paq.push(['setCustomDimension', dimId, dimValue]);
  }
})();
</script>
```

- **Trigger:** Create trigger:
  - **Name:** `Custom Dimension Events`
  - **Type:** `Custom Event`
  - **Event Name:** `customDimension`

---

## Step 4: Summary of Triggers

You should have created these triggers:

| Trigger Name | Type | Event Name | Purpose |
|--------------|------|------------|---------|
| All Pageviews | Page View or Custom Event | `mtm.PageView` | Fires on page loads |
| All Custom Events | Custom Event | `customEvent` | Fires on interactions |
| Custom Dimension Events | Custom Event | `customDimension` | Fires when dimensions set (optional) |

---

## Step 5: Publish Container

After creating all tags, triggers, and variables:

1. Click **"Publish"** (top right)
2. **Version Name:** e.g., "Initial analytics setup"
3. **Description:** "Added pageview tracking, events tracking, and custom dimensions"
4. Click **"Publish Now"**

**Important:** Changes only go live after publishing!

---

## Step 6: Testing & Verification

### Test in Preview Mode

1. **Enable Preview Mode**
   - In MTM, click **"Preview / Debug"**
   - Enter your website URL (including port, e.g., `http://localhost:8080`)
   - Click **"Start Preview"**

2. **Open Your Website** in the same browser

3. **Verify Preview Panel Appears** at bottom of your site

4. **Check Data Layer Tab**
   - Should see events: `mtm.Start`, `mtm.PageView`, `customEvent`, `customDimension`
   - Click each event to see its properties
   - Verify data layer variables have values

5. **Check Tags Tab**
   - When you load a page, "Matomo Analytics - Pageview" should show **"Fired"** (green)
   - When events trigger, "Matomo Analytics - Events" should show **"Fired"**
   - Check "Not Fired" section - tags that didn't fire

### Test in Browser Network Tab

1. **Open DevTools** (F12)
2. Go to **Network** tab
3. **Filter by:** "piwik" or "matomo"
4. **Refresh the page**
5. **Look for requests to:**
   - `piwik.php` or `matomo.php`

6. **Verify Pageview Request:**
   - Should have `action_name=` parameter
   - Should have `idsite=18`
   - Should have `url=` parameter
   - Should **NOT** have `e_c=`, `e_a=` parameters (those are for events)

7. **Verify Event Requests:**
   - Should have `e_c=` (event category)
   - Should have `e_a=` (event action)
   - Should have `idsite=18`

8. **Verify Custom Dimensions:**
   - Look for `dimension1=`, `dimension2=`, etc. in request parameters
   - Or check request payload for dimension data

### Test in Matomo

1. **Go to Matomo Dashboard**
2. **Select your website** (Site ID 18)
3. **Check Real-time Visitors:**
   - Go to **Visitors → Real-time**
   - You should see your current visit
   - Should show pages you visited
   - Should show events you triggered

4. **Check Custom Dimensions:**
   - Go to **Visitors → Custom Dimensions**
   - Select each dimension (1-5)
   - Should see data appearing

---

## Troubleshooting

### Preview Mode Not Connecting

**Symptoms:** Preview panel doesn't appear on your site

**Solutions:**
- Make sure you opened your site in the **same browser** as MTM
- Check that the **URL matches exactly** (including http/https, port)
- Try **disabling ad blockers**
- Check browser console for errors
- Try **incognito/private mode**

### Tags Not Firing

**Symptoms:** Tags show "Not Fired" in preview

**Check:**
- Is the **trigger configured correctly?**
- Is the **event name** spelled correctly? (case-sensitive!)
- Are **data layer events** appearing in Data Layer tab?
- Check **trigger conditions** - may need to adjust

### Variables Show "undefined"

**Symptoms:** Variables in preview show as undefined

**Solutions:**
- **Variable name** must match **exactly** what your code pushes to data layer
- Check **Data Layer tab** to see actual event structure
- Verify **case sensitivity** (eventCategory ≠ eventcategory)

### No Data in Matomo

**Symptoms:** Preview works but no data in Matomo reports

**Check:**
- Is **Site ID** correct in tags? (should be 18)
- Is **Matomo URL** correct?
- Check **Network tab** - are requests reaching Matomo? (200 status)
- Wait **5-10 minutes** - data processing can be delayed
- Check **Visitor Log** instead of Real-time

### Dimensions Not Appearing

**Symptoms:** Events tracked but dimensions missing

**Solutions:**
- Verify **custom dimensions created in Matomo** (not just MTM)
- Check **dimension indices match** (1, 2, 3, 4, 5)
- Ensure dimensions are **Active** in Matomo
- Verify **dimension configuration in tags** (dynamic table)
- Check if `dimensionId` and `dimensionValue` variables have values

### Container Not Publishing

**Symptoms:** Can't publish or changes not live

**Solutions:**
- Check for **validation errors** (red indicators)
- Ensure all **required fields** are filled
- Try **"Preview"** first to find issues
- Check **browser console** for errors
- Contact Matomo admin if permissions issue

---

## Configuration Checklist

Use this checklist to verify complete setup:

### MTM Configuration

- [ ] Container selected and accessible
- [ ] 15 Data Layer Variables created
- [ ] All variables have correct names (case-sensitive)
- [ ] Pageview tag created and configured
- [ ] Events tag created and configured
- [ ] Custom dimensions configured in tags
- [ ] All triggers created and named correctly
- [ ] Container published successfully

### Matomo Configuration

- [ ] 5 Custom dimensions created (see MATOMO_SETUP.md)
- [ ] Dimension indices are 1, 2, 3, 4, 5
- [ ] All dimensions are Active
- [ ] Site ID is correct (18)

### Testing

- [ ] Preview mode connects successfully
- [ ] Data Layer events appear in preview
- [ ] Tags fire correctly in preview
- [ ] Network requests show piwik.php/matomo.php calls
- [ ] Real-time visitors shows activity
- [ ] Custom dimensions show data

### Documentation

- [ ] Team members know where to find this guide
- [ ] Environment-specific values documented (Site ID, URLs)
- [ ] Access credentials stored securely

---

## Environment-Specific Configuration

When setting up multiple environments (dev, staging, production):

### What Changes Per Environment

- **Matomo URL:** May differ per environment
- **Site ID:** Usually different per environment
- **Container ID:** May be different per environment

### What Stays the Same

- **Variable names:** Same across all environments
- **Tag names:** Same across all environments
- **Trigger configuration:** Same across all environments
- **Data layer structure:** Same across all environments

### Recommendation

- **Create separate MTM containers** for each environment
- **Use same configuration** (copy/paste tags & triggers)
- **Only change:** Matomo URL and Site ID
- **Document:** Which container goes with which environment

---

## Maintenance

### When to Update MTM

Update your MTM configuration when:

- **Adding new events** - May need new triggers
- **Adding new custom dimensions** - Update dimension configuration in tags
- **Changing event structure** - Update variables and tags
- **Adding new pages** - Usually automatic, but verify tracking works

### Version Control

- **Always publish with descriptive version names**
- **Document what changed** in version description
- **Keep notes** of major configuration changes
- **Test thoroughly** before publishing to production

---

## Support Resources

- **This Guide:** MTM_CONFIGURATION.md
- **Custom Dimensions Setup:** MATOMO_SETUP.md
- **Code Implementation:** ANALYTICS_IMPLEMENTATION.md
- **Matomo Documentation:** https://matomo.org/docs/
- **MTM Documentation:** https://matomo.org/docs/tag-manager/
- **Data Layer Reference:** https://developer.matomo.org/guides/tagmanager/datalayer

---

## Quick Reference: Complete Setup Flow

1. **Code Setup** → Tracking code in `_document.tsx` ✓ (already done)
2. **MTM Variables** → Create 15 data layer variables (this guide)
3. **Matomo Dimensions** → Create 5 custom dimensions (MATOMO_SETUP.md)
4. **MTM Tags** → Create 2-3 tags (this guide)
5. **MTM Triggers** → Create 2-3 triggers (this guide)
6. **Publish** → Publish MTM container (this guide)
7. **Test** → Verify in preview, network, and Matomo (this guide)
8. **Monitor** → Check Real-time and reports regularly

**Total setup time:** ~2 hours first time, ~30 minutes for subsequent environments

---

*Last updated: 2026-01-08*
*Version: 1.0*