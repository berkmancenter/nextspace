'use client';
import React, { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  TextField,
  Typography,
  Step,
  Stepper,
  StepLabel,
  useTheme,
  useMediaQuery,
  MobileStepper,
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import { useRouter } from 'next/router';
import { Request } from '../utils';
import { EventStatus } from './';
import { components } from '../types';
import { Conversation } from '../types.internal';
import { createConversationFromData, Api, SendData } from '../utils/Helpers';
import SessionManager from '../utils/SessionManager';
import { NewTopicForm, NewTopicFormValues } from './NewTopicForm';

const steps = ['Event Details', 'Conversation Setup', 'Configuration', 'Speakers', 'Resources'];

/**
 * EventCreationForm component
 *
 * Displays the Event Creation form as a multi-step wizard.
 * Step 1: Event Details (name, description, zoom URL, time)
 * Step 2: Conversation Configuration (platforms, agent)
 * Step 3: Agent Configuration (model, bot name)
 * Step 4: Moderators & Speakers (moderator and speaker information)
 * @returns A React component displaying the Event Creation form.
 */
export const EventCreationForm: React.FC = ({}) => {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const [activeStep, setActiveStep] = useState(0);

  const [eventNameHasError, setEventNameHasError] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>('');
  const [eventDescription, setEventDescription] = useState<string>('');

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedConvType, setSelectedConvType] = useState<string | null>(null);
  const [supportedModels, setSupportedModels] = useState<components['schemas']['LlmModelDetails'][] | null>(null);
  const [availablePlatforms, setAvailablePlatforms] = useState<components['schemas']['PlatformConfig'][] | null>(null);
  const [conversationTypes, setConversationTypes] = useState<components['schemas']['ConversationType'][] | null>(null);

  const [zoomMeetingUrl, setZoomMeetingUrl] = useState<string>('');
  const [zoomMeetingUrlHasError, setZoomMeetingUrlHasError] = useState<boolean>(false);
  const [zoomMeetingTime, setZoomMeetingTime] = useState<string>('');
  const [scheduledEndTime, setScheduledEndTime] = useState<string>('');
  const [scheduledEndTimeHasError, setScheduledEndTimeHasError] = useState<boolean>(false);
  const [zoomMeetingTimeHasError, setZoomMeetingTimeHasError] = useState<boolean>(false);
  const [zoomMeetingTimeErrorMessage, setZoomMeetingTimeErrorMessage] = useState<string>(
    'Meeting Start Time is required when an end time is provided.',
  );

  const [dynamicPropertyValues, setDynamicPropertyValues] = useState<Record<string, any>>({});
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pdfUploadWarnings, setPdfUploadWarnings] = useState<string[]>([]);
  const [conversationData, setConversationData] = useState<Conversation | null>(null);

  const [formGroupsErrors, setFormGroupsErrors] = useState({
    platforms: false,
    conversationType: false,
  });
  const [platformsPreviouslyChecked, setPlatformsPreviouslyChecked] = useState(false);

  // Moderators and Speakers state
  const emptySpeaker = () => ({ name: '', bio: '', alternateName: undefined as string | undefined });
  const emptyModerator = () => ({ name: '', bio: '', alternateName: undefined as string | undefined });

  const [moderators, setModerators] = useState([emptyModerator()]);
  const [speakers, setSpeakers] = useState([emptySpeaker()]);
  const [showModerators, setShowModerators] = useState<boolean>(false);

  // Reading & Resources state
  const emptyResource = () => ({
    title: '',
    authors: '',
    year: '',
    url: '',
    description: '',
    citation: '',
    pdf: undefined as File | undefined,
    required: false,
    participantVisible: true,
  });

  const [resources, setResources] = useState<ReturnType<typeof emptyResource>[]>([emptyResource()]);
  const [pdfDragOver, setPdfDragOver] = useState<number | null>(null);

  const addResource = () => setResources((prev) => [...prev, emptyResource()]);

  const updateResource = (
    index: number,
    field: keyof ReturnType<typeof emptyResource>,
    value: string | boolean | File | undefined,
  ) => {
    setResources((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeResource = (index: number) => {
    setResources((prev) => prev.filter((_, i) => i !== index));
  };

  const PDF_MAX_BYTES = 20 * 1024 * 1024;

  const attachPdf = (index: number, file: File) => {
    if (file.size > PDF_MAX_BYTES) {
      setFormError(`"${file.name}" exceeds the 20 MB limit and cannot be attached.`);
      return;
    }
    updateResource(index, 'pdf', file);
  };

  // Topic (Event Series) state
  const [topicMode, setTopicMode] = useState<'existing' | 'new'>('existing');
  const [availableTopics, setAvailableTopics] = useState<components['schemas']['Topic'][] | null>(null);
  const [topicsLoading, setTopicsLoading] = useState<boolean>(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [topicHasError, setTopicHasError] = useState<boolean>(false);
  const [newTopic, setNewTopic] = useState<NewTopicFormValues>({
    name: '',
    description: '',
    public: false,
  });

  const formRef = useRef<HTMLFormElement>(null);

  const setFieldFocus = (fieldName: string) => {
    (formRef.current?.elements.namedItem(fieldName) as HTMLElement)?.focus();
  };

  useEffect(() => {
    if (selectedConvType) {
      const type = conversationTypes?.find((a) => a.name === selectedConvType);
      if (type) {
        // Initialize dynamic property values with defaults
        const initialValues: Record<string, any> = {};
        type.properties?.forEach((prop) => {
          if (prop.name !== 'zoomMeetingUrl') {
            if (prop.default !== undefined) {
              initialValues[prop.name] = prop.default;
            } else if (prop.type === 'enum' && prop.options) {
              // For enum types (single-choice like llmModel)
              if (Array.isArray(prop.options) && prop.options.length > 0) {
                const firstOption = prop.options[0];
                if (prop.validationKeys) {
                  // Extract values using validationKeys
                  const defaultValue: Record<string, any> = {};
                  prop.validationKeys.forEach((key) => {
                    if (typeof firstOption === 'object' && firstOption !== null && key in firstOption) {
                      defaultValue[key] = (firstOption as any)[key];
                    }
                  });
                  initialValues[prop.name] = defaultValue;
                } else {
                  initialValues[prop.name] = firstOption;
                }
              }
            } else if (prop.type === 'object' && prop.schema) {
              // For object types with schema (multi-item like interventionCategories)
              const itemKey = prop.itemKey || 'name';
              const categoryDefaults: Record<string, any> = {};

              prop.schema.forEach((schemaItem: any) => {
                if (schemaItem[itemKey]) {
                  // Build default object from the schema item's default* properties
                  const itemValue: Record<string, any> = {};
                  Object.keys(schemaItem).forEach((key) => {
                    if (key.startsWith('default')) {
                      const actualKey =
                        key.replace('default', '').charAt(0).toLowerCase() + key.replace('default', '').slice(1);
                      itemValue[actualKey] = schemaItem[key];
                    }
                  });
                  categoryDefaults[schemaItem[itemKey]] = itemValue;
                }
              });
              initialValues[prop.name] = categoryDefaults;
            }
          }
        });
        // Initialize feature toggles and their sub-property defaults.
        // Sub-properties are keyed as `featureName.propName` to avoid
        // collisions when multiple features share the same property name.
        type.features?.forEach((feature) => {
          initialValues[feature.name] = feature.default;
          feature.properties?.forEach((prop) => {
            if (prop.default !== undefined) {
              initialValues[`${feature.name}.${prop.name}`] = prop.default;
            }
          });
        });

        setDynamicPropertyValues(initialValues);
      }
    }
  }, [conversationTypes, selectedConvType]);

  useEffect(() => {
    // If all platforms are deselected after one+ selection, error state should be shown
    setFormGroupsErrors((prev) => ({
      ...prev,
      platforms: selectedPlatforms.length === 0 && platformsPreviouslyChecked,
    }));
    setPlatformsPreviouslyChecked(selectedPlatforms.length > 0);
    //Exhaustive-deps disabled to avoid double-dip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatforms]);

  useEffect(() => {
    async function fetchServerConfig() {
      try {
        const config = await Api.get().GetConfig();
        const { supportedModels, availablePlatforms, conversationTypes } = config;

        setSupportedModels(supportedModels);
        setAvailablePlatforms(availablePlatforms);
        setConversationTypes(conversationTypes);
      } catch (error) {
        setFormError('Failed to load configuration.');
      }
    }

    if (!supportedModels || !availablePlatforms || !conversationTypes) fetchServerConfig();
  }, [supportedModels, availablePlatforms, conversationTypes]);

  useEffect(() => {
    async function fetchTopics() {
      setTopicsLoading(true);
      try {
        const userId = SessionManager.get().getSessionInfo()?.userId;
        const [allData, userData] = await Promise.all([Request('topics'), Request('topics/userTopics')]);

        const allTopics: components['schemas']['Topic'][] = Array.isArray(allData) ? allData : [];
        const userTopics: components['schemas']['Topic'][] = Array.isArray(userData) ? userData : [];

        // Merge, deduplicate by id, exclude archived
        const seen = new Set<string>();
        const merged: components['schemas']['Topic'][] = [];
        for (const t of [...allTopics, ...userTopics]) {
          if (!t.id || seen.has(t.id) || t.archived || t.isDeleted) continue;
          // Keep public topics or private topics owned by current user
          if (!t.private || (userId && t.owner === userId)) {
            seen.add(t.id);
            merged.push(t);
          }
        }

        setAvailableTopics(merged);
      } catch {
        setAvailableTopics([]);
      } finally {
        setTopicsLoading(false);
      }
    }

    if (availableTopics === null) fetchTopics();
  }, [availableTopics]);

  const validateStep1 = () => {
    // Check that required fields are present
    if (!eventName || eventName.trim() === '') {
      setFormError('Event Name is required');
      setFieldFocus('name');
      return false;
    }

    // Check topic/series selection
    if (topicMode === 'existing') {
      if (!selectedTopicId) {
        setFormError('An Event Series is required');
        setTopicHasError(true);
        return false;
      }
    } else {
      if (!newTopic.name.trim()) {
        setFormError('Series name is required');
        return false;
      }
    }

    // Check zoom fields
    if (!zoomMeetingUrl) {
      setFormError('Zoom Meeting URL is required');
      setFieldFocus('zoomMeetingUrl');
      return false;
    }

    if (zoomMeetingTime && new Date(zoomMeetingTime) < new Date(Date.now() + 10 * 60 * 1000)) {
      setFormError('Meeting Start Time must be at least 10 minutes from now');
      setZoomMeetingTimeErrorMessage('Meeting Start Time must be at least 10 minutes from now.');
      setZoomMeetingTimeHasError(true);
      return false;
    }

    if (scheduledEndTime && !zoomMeetingTime) {
      setFormError('Meeting Start Time is required when an end time is provided');
      setZoomMeetingTimeErrorMessage('Meeting Start Time is required when an end time is provided.');
      setZoomMeetingTimeHasError(true);
      return false;
    }

    if (zoomMeetingTime && !scheduledEndTime) {
      setFormError('Meeting End Time is required when a start time is provided');
      return false;
    }

    if (zoomMeetingTime && scheduledEndTime && scheduledEndTime <= zoomMeetingTime) {
      setFormError('Meeting End Time must be after the start time');
      return false;
    }

    setFormError(null);
    setTopicHasError(false);
    return true;
  };

  const validateStep2 = () => {
    // Check that at least one platform is selected
    if (selectedPlatforms.length === 0) {
      setFormError('At least one platform must be selected');
      setFieldFocus('nextspace');
      setFormGroupsErrors((prev) => ({ ...prev, platforms: true }));
      return false;
    }

    // Check that agent is selected
    if (!selectedConvType) {
      setFormError('At least one agent must be selected');
      setFieldFocus('agent-option-0');
      setFormGroupsErrors((prev) => ({ ...prev, conversationType: true }));
      return false;
    }

    // Check form validity using HTML validation
    if (!formRef.current?.checkValidity()) {
      setFormError('Please fill out all required fields.');
      return false;
    }

    setFormError(null);
    setFormGroupsErrors({ platforms: false, conversationType: false });

    return true;
    setFormError(null);
    return true;
  };

  const validateStep3 = () => {
    // Step 3 fields are optional or have defaults, so always valid
    setFormError(null);
    return true;
  };

  // Moderator management functions
  const addModerator = () => {
    setModerators([...moderators, emptyModerator()]);
  };

  const removeModerator = (index: number) => {
    if (moderators.length > 1) {
      setModerators(moderators.filter((_, i) => i !== index));
    }
  };

  const updateModerator = (index: number, field: 'name' | 'bio' | 'alternateName', value: string) => {
    const updated = [...moderators];
    updated[index][field] = value;
    setModerators(updated);
  };

  // Speaker management functions
  const addSpeaker = () => {
    setSpeakers([...speakers, emptySpeaker()]);
  };

  const removeSpeaker = (index: number) => {
    if (speakers.length > 1) {
      setSpeakers(speakers.filter((_, i) => i !== index));
    }
  };

  const updateSpeaker = (index: number, field: 'name' | 'bio' | 'alternateName', value: string) => {
    const updated = [...speakers];
    updated[index][field] = value;
    setSpeakers(updated);
  };

  // Helper function to render dynamic property fields.
  // Pass `namespace` (feature name) to scope sub-property keys and prevent
  // collisions when multiple features share the same property name.
  const renderDynamicPropertyField = (prop: components['schemas']['ConfigProperty'], namespace?: string) => {
    const stateKey = namespace ? `${namespace}.${prop.name}` : prop.name;
    const value = dynamicPropertyValues[stateKey];

    switch (prop.type) {
      case 'string':
        return (
          <TextField
            key={stateKey}
            name={stateKey}
            label={prop.label}
            value={value || prop.default || ''}
            helperText={prop.description}
            fullWidth
            variant="outlined"
            margin="normal"
            required={prop.required}
            onChange={(e) => {
              setDynamicPropertyValues((prev) => ({
                ...prev,
                [stateKey]: e.target.value,
              }));
            }}
          />
        );

      case 'number':
        return (
          <TextField
            key={stateKey}
            name={stateKey}
            label={prop.label}
            type="number"
            value={value === 0 || value === null || value === undefined ? '' : value}
            helperText={prop.description}
            fullWidth
            variant="outlined"
            margin="normal"
            required={prop.required}
            slotProps={{ htmlInput: { min: 0, step: 1 } }}
            onChange={(e) => {
              const inputValue = e.target.value;
              if (inputValue === '') {
                setDynamicPropertyValues((prev) => ({
                  ...prev,
                  [stateKey]: 0,
                }));
              } else {
                const numValue = parseInt(inputValue, 10);
                setDynamicPropertyValues((prev) => ({
                  ...prev,
                  [stateKey]: isNaN(numValue) ? 0 : numValue,
                }));
              }
            }}
          />
        );

      case 'boolean':
        return (
          <FormControlLabel
            key={stateKey}
            control={
              <Checkbox
                checked={value !== undefined ? Boolean(value) : Boolean(prop.default)}
                onChange={(e) => {
                  setDynamicPropertyValues((prev) => ({
                    ...prev,
                    [stateKey]: e.target.checked,
                  }));
                }}
              />
            }
            label={prop.label}
            sx={{ mt: 1 }}
          />
        );

      case 'enum':
        // Single-choice enum (like llmModel) - renders as radio buttons
        if (prop.options && Array.isArray(prop.options)) {
          return (
            <FormControl
              key={stateKey}
              component="fieldset"
              fullWidth
              margin="normal"
              required={prop.required}
              sx={{
                border: '1px solid rgba(0, 0, 0, 0.23)',
                borderRadius: 1,
                p: 2,
                '&:focus-within': {
                  borderColor: 'primary.main',
                  borderWidth: '2px',
                },
              }}
            >
              <FormLabel
                component="legend"
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'rgba(0, 0, 0, 0.87)',
                }}
              >
                {prop.label}
              </FormLabel>
              {prop.description && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  {prop.description}
                </Typography>
              )}
              <RadioGroup
                value={JSON.stringify(value || {})}
                name={stateKey}
                onChange={(e) => {
                  try {
                    const parsedValue = JSON.parse(e.target.value);
                    setDynamicPropertyValues((prev) => ({
                      ...prev,
                      [stateKey]: parsedValue,
                    }));
                  } catch (err) {
                    console.error('Failed to parse radio value:', err);
                  }
                }}
                sx={{ mt: 1 }}
              >
                {prop.options.map((option, idx) => {
                  // Create value object from validation keys
                  const optionValue: Record<string, any> = {};
                  if (prop.validationKeys) {
                    prop.validationKeys.forEach((key) => {
                      if (typeof option === 'object' && option !== null && key in option) {
                        optionValue[key] = option[key];
                      }
                    });
                  } else {
                    // No validation keys, use the option as-is
                    return (
                      <div key={idx}>
                        <FormControlLabel
                          value={JSON.stringify(option)}
                          control={<Radio />}
                          label={
                            typeof option === 'object' && option !== null
                              ? option.label || option.name || `Option ${idx + 1}`
                              : String(option)
                          }
                        />
                      </div>
                    );
                  }

                  return (
                    <div key={idx}>
                      <FormControlLabel
                        value={JSON.stringify(optionValue)}
                        control={<Radio />}
                        label={option.label || option.name || `Option ${idx + 1}`}
                      />
                      {option.description && <div className="text-gray-600 text-sm ml-8 -mt-2">{option.description}</div>}
                    </div>
                  );
                })}
              </RadioGroup>
            </FormControl>
          );
        }
        return null;

      case 'object':
        // Multi-item object configuration (like interventionCategories)
        if (prop.schema && Array.isArray(prop.schema)) {
          const itemKey = prop.itemKey || 'name';

          return (
            <Box key={stateKey} sx={{ mb: 3 }}>
              <FormLabel
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'rgba(0, 0, 0, 0.87)',
                  mb: 1,
                  display: 'block',
                }}
              >
                {prop.label}
              </FormLabel>
              {prop.description && (
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                  {prop.description}
                </Typography>
              )}
              <Box sx={{ pl: 0 }}>
                {prop.schema.map((schemaItem: any) => {
                  const key = schemaItem[itemKey];

                  // Get current value or use defaults from schema
                  const itemValue =
                    value?.[key] ||
                    (() => {
                      const defaults: Record<string, any> = {};
                      Object.keys(schemaItem).forEach((k) => {
                        if (k.startsWith('default')) {
                          const actualKey =
                            k.replace('default', '').charAt(0).toLowerCase() + k.replace('default', '').slice(1);
                          defaults[actualKey] = schemaItem[k];
                        }
                      });
                      return defaults;
                    })();

                  // Get all editable fields (exclude metadata like name, label, description)
                  const editableFields = Object.keys(itemValue).filter(
                    (fieldKey) =>
                      !['name', 'label', 'description', 'interventions', 'requiresPrivateMessages'].includes(fieldKey),
                  );

                  return (
                    <Box
                      key={key}
                      sx={{
                        mb: 2,
                        p: 2,
                        border: '1px solid rgba(0, 0, 0, 0.12)',
                        borderRadius: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {schemaItem.label || schemaItem.name || key}
                        </Typography>
                        {schemaItem.description && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                            {schemaItem.description}
                          </Typography>
                        )}
                      </Box>

                      {/* Render each editable field */}
                      <Box sx={{ mt: 1 }}>
                        {editableFields.map((fieldKey) => {
                          const fieldValue = itemValue[fieldKey];

                          // Render boolean fields as checkboxes
                          if (typeof fieldValue === 'boolean') {
                            return (
                              <FormControlLabel
                                key={fieldKey}
                                control={
                                  <Checkbox
                                    checked={fieldValue}
                                    onChange={(e) => {
                                      setDynamicPropertyValues((prev) => ({
                                        ...prev,
                                        [stateKey]: {
                                          ...prev[stateKey],
                                          [key]: {
                                            ...itemValue,
                                            [fieldKey]: e.target.checked,
                                          },
                                        },
                                      }));
                                    }}
                                  />
                                }
                                label={fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}
                              />
                            );
                          }

                          // Render numeric fields as number inputs
                          if (typeof fieldValue === 'number') {
                            return (
                              <TextField
                                key={fieldKey}
                                label={fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}
                                type="number"
                                value={fieldValue === 0 ? '' : fieldValue}
                                slotProps={{
                                  htmlInput: { min: 0, max: 10, step: 1 },
                                }}
                                size="small"
                                sx={{ mt: 1, width: '100%' }}
                                onChange={(e) => {
                                  const inputValue = e.target.value;

                                  let newValue;
                                  if (inputValue === '') {
                                    newValue = 0;
                                  } else {
                                    const numValue = parseInt(inputValue, 10);
                                    newValue = isNaN(numValue) ? 0 : numValue;
                                  }
                                  setDynamicPropertyValues((prev) => ({
                                    ...prev,
                                    [stateKey]: {
                                      ...prev[stateKey],
                                      [key]: {
                                        ...itemValue,
                                        [fieldKey]: newValue,
                                      },
                                    },
                                  }));
                                }}
                              />
                            );
                          }

                          // Render string fields as text inputs
                          if (typeof fieldValue === 'string') {
                            return (
                              <TextField
                                key={fieldKey}
                                label={fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}
                                value={fieldValue}
                                size="small"
                                sx={{ mt: 1, width: '100%' }}
                                onChange={(e) => {
                                  setDynamicPropertyValues((prev) => ({
                                    ...prev,
                                    [stateKey]: {
                                      ...prev[stateKey],
                                      [key]: {
                                        ...itemValue,
                                        [fieldKey]: e.target.value,
                                      },
                                    },
                                  }));
                                }}
                              />
                            );
                          }

                          return null;
                        })}
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>
          );
        }
        return null;

      default:
        return null;
    }
  };

  const handleNext = () => {
    if (activeStep === 0 && !validateStep1()) return;
    if (activeStep === 1 && !validateStep2()) return;
    if (activeStep === 2 && !validateStep3()) return;
    // Steps 3 and 4 have no required fields — always advance
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setFormError(null);
  };

  const sendData = async (formData: FormData) => {
    // Validate step 3 before submission (though it's currently always valid)
    if (!validateStep3()) return;

    // Resolve topic ID: create new topic if needed
    let topicId = selectedTopicId;
    if (topicMode === 'new') {
      const topicPayload: Record<string, any> = {
        name: newTopic.name,
        private: !newTopic.public,
        votingAllowed: true,
        conversationCreationAllowed: true,
        archivable: true,
        ...(newTopic.description && {
          description: newTopic.description,
        }),
      };
      try {
        const topicResult = await Request('topics', topicPayload);
        if (!topicResult || topicResult.error) {
          setFormError(topicResult?.message?.message || 'Failed to create Event Series.');
          return;
        }
        topicId = topicResult.id;
      } catch (error) {
        setFormError('Failed to create Event Series');
        return;
      }
    }

    // Filter out empty moderators and speakers
    const validModerators = showModerators ? moderators.filter((m) => m.name.trim() !== '' || m.bio.trim() !== '') : [];
    const validSpeakers = speakers.filter((s) => s.name.trim() !== '' || s.bio.trim() !== '');

    // Build resources payload — exclude entries with no title
    const validResources = resources
      .filter((r) => r.title.trim() !== '')
      .map((r) => ({
        source: 'speaker' as const,
        category: r.required ? ('required' as const) : ('suggested' as const),
        title: r.title.trim(),
        ...(r.authors.trim() && {
          authors: r.authors
            .split(',')
            .map((a) => a.trim())
            .filter(Boolean),
        }),
        ...(r.year.trim() && { year: r.year.trim() }),
        ...(r.url.trim() && { url: r.url.trim() }),
        ...(r.description.trim() && { description: r.description.trim() }),
        ...(r.citation.trim() && { citation: r.citation.trim() }),
        participantVisible: r.participantVisible,
      }));

    let body: any = {
      name: eventName,
      ...(eventDescription && { description: eventDescription }),
      ...(zoomMeetingTime && { scheduledTime: zoomMeetingTime }),
      ...(scheduledEndTime && { scheduledEndTime }),
      platforms: selectedPlatforms,
      type: selectedConvType,
      topicId,
      ...(validModerators.length > 0 && { moderators: validModerators }),
      ...(validSpeakers.length > 0 && { presenters: validSpeakers }),
      ...(validResources.length > 0 && { resources: validResources }),
    };

    // Dynamically build properties based on conversationType schema
    const properties: Record<string, any> = {
      zoomMeetingUrl,
    };

    const selectedType = conversationTypes?.find((type) => type.name === selectedConvType);

    if (selectedType?.properties) {
      selectedType.properties.forEach((prop) => {
        if (prop.name === 'zoomMeetingUrl') {
          // Already handled above
          return;
        }

        const value = dynamicPropertyValues[prop.name];

        // Only include the property if it has a value or if it's required
        if (value !== undefined && value !== null && value !== '') {
          properties[prop.name] = value;
        } else if (prop.required && prop.default !== undefined) {
          properties[prop.name] = prop.default;
        }
      });
    }

    const features = (selectedType?.features ?? [])
      .filter((feature) => Boolean(dynamicPropertyValues[feature.name]))
      .map((feature) => {
        const config: Record<string, any> = {};
        feature.properties?.forEach((prop) => {
          const value = dynamicPropertyValues[`${feature.name}.${prop.name}`];
          if (value !== undefined && value !== null && value !== '') {
            config[prop.name] = value;
          } else if (prop.default !== undefined) {
            config[prop.name] = prop.default;
          }
        });
        return { name: feature.name, config };
      });

    body = {
      ...body,
      properties,
      ...(features.length > 0 && { features }),
    };

    setFormSubmitting(true);
    Request('conversations/from-type', body)
      .then(async (data) => {
        if (!data) {
          setFormError('Failed to send data. Please try again.');
          setFormSubmitting(false);
          return;
        }
        if ('error' in data) {
          setFormError(data.message?.message || 'Failed to create conversation.');
          setFormSubmitting(false);
          return;
        }

        // Upload PDFs for any resources that have one attached
        const conversationId = data.id as string;
        const responseResources: components['schemas']['Resource'][] = data.resources ?? [];
        const resourcesWithPdf = resources
          .filter((r) => r.title.trim() !== '' && r.pdf)
          .flatMap((r) => {
            const match = responseResources.find((res) => res.title === r.title.trim());
            return match?.id ? [{ pdf: r.pdf as File, resourceId: match.id }] : [];
          });

        if (resourcesWithPdf.length > 0) {
          const uploadResults = await Promise.allSettled(
            resourcesWithPdf.map(({ pdf, resourceId }) => {
              const formData = new FormData();
              formData.append('pdf', pdf);
              return SendData(`resources/${conversationId}/${resourceId}/pdf`, null, undefined, {
                method: 'POST',
                body: formData,
              });
            }),
          );

          const failures = uploadResults
            .map((result, i) => ({ result, name: resourcesWithPdf[i].pdf.name }))
            .filter(({ result }) => result.status === 'rejected' || (result.status === 'fulfilled' && result.value?.error))
            .map(({ name }) => name);

          if (failures.length > 0) {
            setPdfUploadWarnings(failures);
          }
        }

        createConversationFromData(data).then((conversation) => {
          setConversationData(conversation);
          setFormSubmitted(true);
        });
      })
      .catch((error) => {
        console.error('Error sending data:', error);
        setFormError(`Failed to send data. (${error.message})`);
        setFormSubmitting(false);
      });
  };

  if (formSubmitted && conversationData) {
    return (
      <>
        {pdfUploadWarnings.length > 0 && (
          <Alert severity="warning" sx={{ maxWidth: 800, mx: 'auto', mt: 4 }}>
            The following PDFs could not be uploaded and will not be available as AI context:{' '}
            <strong>{pdfUploadWarnings.join(', ')}</strong>. You can retry by editing the event.
          </Alert>
        )}
        <EventStatus conversationData={conversationData} />
      </>
    );
  }

  return (
    <>
      <Typography variant="h4" className="text-center" gutterBottom>
        Create Event
      </Typography>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 800, mx: 'auto', mt: 4, mb: 4 }}>
        {isMobile ? (
          <MobileStepper
            variant="dots"
            steps={steps.length}
            position="static"
            activeStep={activeStep}
            sx={{
              mb: 2,
              justifyContent: 'center',
              background: 'transparent',
            }}
            nextButton={<span />}
            backButton={<span />}
          />
        ) : (
          <Stepper activeStep={activeStep} orientation="horizontal" sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        )}

        {formError && (
          <Snackbar
            open={Boolean(formError)}
            autoHideDuration={4000}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            onClose={() => {
              setFormError(null);
            }}
          >
            <Alert
              variant="filled"
              severity="error"
              onClose={() => {
                setFormError(null);
              }}
              sx={{ mt: 2 }}
            >
              {formError}
            </Alert>
          </Snackbar>
        )}

        <Box component="form" noValidate action="#" ref={formRef}>
          {/* Step 1: Event Details */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Event Details
              </Typography>
              <TextField
                name="name"
                label="Event Name"
                id="thread-name"
                fullWidth
                variant="outlined"
                margin="normal"
                required
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                helperText={eventNameHasError ? 'Enter a name for your event.' : null}
                onBlur={() =>
                  setEventNameHasError(
                    !formRef.current?.elements.namedItem('name') ||
                      !(formRef.current.elements.namedItem('name') as HTMLInputElement).value,
                  )
                }
                error={eventNameHasError}
              />

              <TextField
                name="description"
                label="Event Description"
                id="event-description"
                helperText="Provide a detailed description of your event (optional)."
                fullWidth
                variant="outlined"
                margin="normal"
                multiline
                rows={6}
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
              />

              {/* Event Series (topic) selection */}
              <FormControl
                component="fieldset"
                fullWidth
                margin="normal"
                error={topicHasError}
                sx={{
                  border: topicHasError ? '2px solid red' : '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  p: 2,
                  '&:focus-within': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              >
                <FormLabel
                  component="legend"
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgba(0, 0, 0, 0.87)',
                  }}
                >
                  Event Series *
                </FormLabel>
                <RadioGroup
                  row
                  value={topicMode}
                  onChange={(e) => {
                    setTopicMode(e.target.value as 'existing' | 'new');
                    setTopicHasError(false);
                  }}
                  sx={{ mb: 1 }}
                >
                  <FormControlLabel value="existing" control={<Radio size="small" />} label="Choose existing series" />
                  <FormControlLabel value="new" control={<Radio size="small" />} label="Create new series" />
                </RadioGroup>

                {topicMode === 'existing' && (
                  <Autocomplete
                    options={[...(availableTopics ?? [])].sort(
                      (a, b) => Number(a.private) - Number(b.private) || a.name.localeCompare(b.name),
                    )}
                    loading={topicsLoading}
                    groupBy={(option) => (option.private ? 'Private (Yours)' : 'Public')}
                    getOptionLabel={(option) => option.name}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    value={availableTopics?.find((t) => t.id === selectedTopicId) ?? null}
                    onBlur={() => setTopicHasError(!selectedTopicId)}
                    onChange={(_, value) => {
                      setSelectedTopicId(value?.id ?? null);
                      setTopicHasError(false);
                    }}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} key={option.id}>
                        <Box sx={{ flexGrow: 1 }}>{option.name}</Box>
                        {option.private && (
                          <Typography variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                            private
                          </Typography>
                        )}
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select a series"
                        required
                        error={topicHasError}
                        helperText={topicHasError ? 'Please select an Event Series.' : undefined}
                        slotProps={{
                          input: {
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {topicsLoading ? <CircularProgress color="inherit" size={18} /> : null}
                                {params.InputProps.endAdornment}
                              </>
                            ),
                          },
                        }}
                      />
                    )}
                  />
                )}

                {topicMode === 'new' && <NewTopicForm values={newTopic} onChange={setNewTopic} />}
              </FormControl>

              <TextField
                name="zoomUrl"
                label="Zoom Meeting URL"
                id="zoom-url"
                value={zoomMeetingUrl}
                fullWidth
                onChange={(e) => setZoomMeetingUrl(e.target.value)}
                onBlur={() =>
                  // Check format on unfocus
                  setZoomMeetingUrlHasError(!zoomMeetingUrl || zoomMeetingUrl.length < 10)
                }
                error={zoomMeetingUrlHasError}
                helperText={zoomMeetingUrlHasError ? 'Enter the Zoom Meeting URL for transcription purposes.' : null}
                variant="outlined"
                margin="normal"
                required
              />

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                  label="Meeting Day/Time"
                  value={zoomMeetingTime ? dayjs(zoomMeetingTime) : null}
                  minDateTime={dayjs().add(10, 'minute')}
                  onChange={(newValue) => {
                    const value = newValue?.isValid() ? newValue.toISOString() : '';
                    setZoomMeetingTime(value);
                    setZoomMeetingTimeHasError(!value && !!scheduledEndTime);
                    if (scheduledEndTime) {
                      setScheduledEndTimeHasError(!!value && scheduledEndTime <= value);
                    }
                  }}
                  slotProps={{
                    textField: {
                      margin: 'normal',
                      fullWidth: true,
                      error: zoomMeetingTimeHasError,
                      helperText: zoomMeetingTimeHasError
                        ? zoomMeetingTimeErrorMessage
                        : 'Enter the meeting start time if it begins more than 15 minutes from now.',
                    },
                  }}
                />
                <DateTimePicker
                  label="Meeting End Time"
                  value={scheduledEndTime ? dayjs(scheduledEndTime) : null}
                  minDateTime={zoomMeetingTime ? dayjs(zoomMeetingTime).add(1, 'minute') : undefined}
                  onChange={(newValue) => {
                    const value = newValue?.isValid() ? newValue.toISOString() : '';
                    setScheduledEndTime(value);
                    setScheduledEndTimeHasError(!!value && !!zoomMeetingTime && value <= zoomMeetingTime);
                    setZoomMeetingTimeHasError(!value ? false : !zoomMeetingTime);
                  }}
                  slotProps={{
                    textField: {
                      margin: 'normal',
                      fullWidth: true,
                      error: scheduledEndTimeHasError,
                      helperText: scheduledEndTimeHasError
                        ? 'Meeting End Time must be after the start time.'
                        : 'Enter the scheduled end time for the meeting (optional).',
                    },
                  }}
                />
              </LocalizationProvider>
            </Box>
          )}

          {/* Step 2: Conversation Setup */}
          {activeStep === 1 && (
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Conversation Setup
              </Typography>

              {/* Platform Selection */}
              <FormControl
                component="fieldset"
                fullWidth
                margin="normal"
                sx={{
                  border: formGroupsErrors.platforms ? '2px solid red' : '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  p: 2,
                  '&:focus-within': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              >
                <FormLabel
                  component="legend"
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgba(0, 0, 0, 0.87)',
                  }}
                >
                  Where do you want your audience to interact?
                </FormLabel>
                <FormGroup sx={{ mt: -1 }}>
                  {(availablePlatforms || []).map((platform) => (
                    <FormControlLabel
                      key={platform.name}
                      control={
                        <Checkbox
                          name={platform.name.toLowerCase()}
                          checked={selectedPlatforms.indexOf(platform.name) > -1}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPlatforms([...selectedPlatforms, platform.name]);
                            } else {
                              setSelectedPlatforms(selectedPlatforms.filter((item) => item !== platform.name));
                            }
                          }}
                        />
                      }
                      label={platform.label || platform.name}
                    />
                  ))}
                </FormGroup>
              </FormControl>

              {/* Type Selection TODO the UI calls this Agent but we refer to it as conversation type. Change?*/}
              <FormControl
                component="fieldset"
                fullWidth
                required
                margin="normal"
                sx={{
                  border: formGroupsErrors.conversationType ? '2px solid red' : '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: 1,
                  p: 2,
                  '&:focus-within': {
                    borderColor: 'primary.main',
                    borderWidth: '2px',
                  },
                }}
              >
                <FormLabel
                  component="legend"
                  sx={{
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    color: 'rgba(0, 0, 0, 0.87)',
                  }}
                >
                  Agent that you will be using
                </FormLabel>
                <RadioGroup
                  value={selectedConvType}
                  name="selectedConvType"
                  onChange={(e) => {
                    setSelectedConvType(e.target.value);
                    setFormGroupsErrors((prev) => ({
                      ...prev,
                      conversationType: false,
                    }));
                  }}
                  sx={{ mt: -1 }}
                >
                  {(conversationTypes || []).map((option, index) => (
                    <div key={option.name}>
                      <FormControlLabel
                        value={option.name}
                        control={<Radio name={`agent-option-${index}`} />}
                        label={option.label}
                        sx={
                          index === 0
                            ? {
                                '& .MuiFormControlLabel-asterisk': {
                                  display: 'none',
                                },
                              }
                            : {}
                        }
                      />
                      <div className="text-gray-600 text-sm ml-8 -mt-2">{option.description}</div>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
            </Box>
          )}

          {/* Step 3: Configuration */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Customize your conversation settings
              </Typography>

              {conversationTypes
                ?.find((type) => type.name === selectedConvType)
                ?.properties?.filter((prop) => prop.name !== 'zoomMeetingUrl')
                .map((prop) => renderDynamicPropertyField(prop))}

              {(() => {
                const features = conversationTypes
                  ?.find((type) => type.name === selectedConvType)
                  ?.features?.filter((f) => f.userControlled === false);
                if (!features?.length) return null;
                return (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                      Features
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Enable additional capabilities for this conversation
                    </Typography>
                    {features.map((feature) => (
                      <Box
                        key={feature.name}
                        sx={{
                          mb: 1,
                          p: 2,
                          border: '1px solid',
                          borderColor: dynamicPropertyValues[feature.name] ? 'primary.main' : 'divider',
                          borderRadius: 1,
                          transition: 'border-color 0.2s',
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={Boolean(dynamicPropertyValues[feature.name])}
                              onChange={(e) => {
                                setDynamicPropertyValues((prev) => ({
                                  ...prev,
                                  [feature.name]: e.target.checked,
                                }));
                              }}
                            />
                          }
                          label={
                            <Box>
                              <Typography fontWeight={500}>{feature.label}</Typography>
                              {feature.description && (
                                <Typography variant="caption" color="text.secondary">
                                  {feature.description}
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        {dynamicPropertyValues[feature.name] &&
                          feature.properties?.map((prop) => renderDynamicPropertyField(prop, feature.name))}
                      </Box>
                    ))}
                  </Box>
                );
              })()}
            </Box>
          )}

          {/* Step 4: Moderators & Speakers */}
          {activeStep === 3 && (
            <Box sx={{ maxHeight: '600px', overflowY: 'auto', pr: 1 }}>
              {/* About the Speakers Section */}
              <Typography variant="h5" component="h2" gutterBottom>
                About the Speakers
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Add information about the event speakers (optional)
              </Typography>

              {speakers.map((speaker, index) => (
                <Box
                  key={index}
                  sx={{
                    mb: 3,
                    p: 2,
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    borderRadius: 1,
                    position: 'relative',
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      Speaker {index + 1}
                    </Typography>
                    {speakers.length > 1 && (
                      <Button size="small" color="error" onClick={() => removeSpeaker(index)}>
                        Remove
                      </Button>
                    )}
                  </Box>
                  <TextField
                    label="Name"
                    value={speaker.name}
                    onChange={(e) => updateSpeaker(index, 'name', e.target.value)}
                    fullWidth
                    variant="outlined"
                    margin="normal"
                  />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
                    Attendees or the live transcription might use a nickname, abbreviation, or misspelling. Adding it here
                    helps the platform connect those references to the right person.
                  </Typography>
                  <TextField
                    label="Alternate Name"
                    value={speaker.alternateName ?? ''}
                    onChange={(e) => updateSpeaker(index, 'alternateName', e.target.value)}
                    fullWidth
                    variant="outlined"
                    placeholder="Separate multiple names with commas, e.g. Jon, Dr. Smith"
                  />
                  <TextField
                    label="Bio"
                    value={speaker.bio}
                    onChange={(e) => updateSpeaker(index, 'bio', e.target.value)}
                    fullWidth
                    variant="outlined"
                    margin="normal"
                    multiline
                    rows={6}
                  />
                </Box>
              ))}

              <Button variant="outlined" onClick={addSpeaker} sx={{ mb: 2 }}>
                + Add Another Speaker
              </Button>

              {/* About the Moderators Section */}
              <Box sx={{ mt: 2 }}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="h5" component="h2" gutterBottom sx={{ mb: 0 }}>
                    About the Moderators
                  </Typography>

                  {showModerators && (
                    <Button
                      size="small"
                      onClick={() => {
                        setShowModerators(false);
                        setModerators([emptyModerator()]);
                      }}
                    >
                      Remove All
                    </Button>
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add information about the event moderators (optional)
                </Typography>

                {showModerators && (
                  <>
                    {moderators.map((moderator, index) => (
                      <Box
                        key={index}
                        sx={{
                          mb: 3,
                          p: 2,
                          border: '1px solid rgba(0, 0, 0, 0.12)',
                          borderRadius: 1,
                          position: 'relative',
                        }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 1,
                          }}
                        >
                          <Typography variant="subtitle2" color="text.secondary">
                            Moderator {index + 1}
                          </Typography>
                          {moderators.length > 1 && (
                            <Button size="small" color="error" onClick={() => removeModerator(index)}>
                              Remove
                            </Button>
                          )}
                        </Box>
                        <TextField
                          label="Name"
                          value={moderator.name}
                          onChange={(e) => updateModerator(index, 'name', e.target.value)}
                          fullWidth
                          variant="outlined"
                          margin="normal"
                          placeholder="Enter moderator's name"
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 0.5 }}>
                          Attendees or the live transcription might use a nickname, abbreviation, or misspelling. Adding it
                          here helps the platform connect those references to the right person.
                        </Typography>
                        <TextField
                          label="Alternate Name"
                          value={moderator.alternateName ?? ''}
                          onChange={(e) => updateModerator(index, 'alternateName', e.target.value)}
                          fullWidth
                          variant="outlined"
                          placeholder="Separate multiple names with commas, e.g. Jon, Dr. Smith"
                        />
                        <TextField
                          label="Bio"
                          value={moderator.bio}
                          onChange={(e) => updateModerator(index, 'bio', e.target.value)}
                          fullWidth
                          variant="outlined"
                          margin="normal"
                          multiline
                          rows={6}
                          placeholder="Enter moderator's biography, background, and expertise..."
                        />
                      </Box>
                    ))}
                  </>
                )}

                <Button
                  variant="outlined"
                  onClick={() => {
                    if (!showModerators) {
                      setShowModerators(true);
                    } else {
                      addModerator();
                    }
                  }}
                >
                  {showModerators ? '+ Add Another Moderator' : '+ Add Moderators'}
                </Button>
              </Box>
            </Box>
          )}

          {/* Step 5: Reading & Resources */}
          {activeStep === 4 && (
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Reading & Resources
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Add papers, articles, or links that attendees and the AI should know about (optional). Only the title is
                required — fill in what you have. To make a resource available as background context for the AI, attach a PDF
                — the AI will not have access to linked URLs alone.
              </Typography>

              {resources.length === 0 && (
                <Box
                  sx={{
                    p: 2,
                    border: '1px dashed rgba(0,0,0,0.2)',
                    borderRadius: 1,
                    textAlign: 'center',
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    No resources added yet.
                  </Typography>
                </Box>
              )}

              {resources.map((resource, index) => (
                <Box
                  key={index}
                  sx={{
                    mb: 2,
                    p: 2,
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 1,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Resource {index + 1}
                    </Typography>
                    {resources.length > 1 && (
                      <Button size="small" color="error" onClick={() => removeResource(index)}>
                        Remove
                      </Button>
                    )}
                  </Box>

                  <TextField
                    label="Title"
                    value={resource.title}
                    onChange={(e) => updateResource(index, 'title', e.target.value)}
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    required
                    placeholder="e.g. Attention Is All You Need"
                  />
                  <TextField
                    label="URL"
                    value={resource.url}
                    onChange={(e) => updateResource(index, 'url', e.target.value)}
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    placeholder="https://..."
                  />
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                    <TextField
                      label="Authors"
                      value={resource.authors}
                      onChange={(e) => updateResource(index, 'authors', e.target.value)}
                      variant="outlined"
                      margin="dense"
                      placeholder="Jane Smith, John Doe…"
                      helperText="Comma-separated. Use First Last order."
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      label="Year"
                      value={resource.year}
                      onChange={(e) => updateResource(index, 'year', e.target.value)}
                      variant="outlined"
                      margin="dense"
                      placeholder="2024"
                      sx={{ width: 100 }}
                    />
                  </Box>
                  <TextField
                    label="Citation (optional)"
                    value={resource.citation}
                    onChange={(e) => updateResource(index, 'citation', e.target.value)}
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    placeholder="e.g. Vaswani et al. (2017). Attention is all you need. NeurIPS."
                  />
                  <TextField
                    label="Description"
                    value={resource.description}
                    onChange={(e) => updateResource(index, 'description', e.target.value)}
                    fullWidth
                    variant="outlined"
                    margin="dense"
                    multiline
                    rows={3}
                    helperText="Express why this reading matters for this session. This is shown to attendees."
                    placeholder="Why is this reading relevant to the session?"
                  />

                  {/* PDF attachment */}
                  <Box sx={{ mt: 1.5, mb: 0.5 }}>
                    <input
                      type="file"
                      accept="application/pdf"
                      style={{ display: 'none' }}
                      id={`pdf-upload-${index}`}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) attachPdf(index, file);
                        e.target.value = '';
                      }}
                    />
                    {resource.pdf ? (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          p: 1.5,
                          border: '1px solid rgba(0,0,0,0.12)',
                          borderRadius: 1,
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={500}>
                            {resource.pdf.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {(resource.pdf.size / 1024 / 1024).toFixed(1)} MB · Used as AI background context
                          </Typography>
                        </Box>
                        <Button size="small" onClick={() => document.getElementById(`pdf-upload-${index}`)?.click()}>
                          Replace
                        </Button>
                        <Button size="small" color="error" onClick={() => updateResource(index, 'pdf', undefined)}>
                          Remove
                        </Button>
                      </Box>
                    ) : (
                      <Box
                        onClick={() => document.getElementById(`pdf-upload-${index}`)?.click()}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setPdfDragOver(index);
                        }}
                        onDragLeave={() => setPdfDragOver(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setPdfDragOver(null);
                          const file = e.dataTransfer.files?.[0];
                          if (file?.type === 'application/pdf') {
                            attachPdf(index, file);
                          }
                        }}
                        sx={{
                          p: 2,
                          border: '1px dashed',
                          borderColor: pdfDragOver === index ? 'primary.main' : 'rgba(0,0,0,0.2)',
                          borderRadius: 1,
                          textAlign: 'center',
                          cursor: 'pointer',
                          bgcolor: pdfDragOver === index ? 'action.hover' : 'transparent',
                          transition: 'border-color 0.15s, background-color 0.15s',
                          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          Drop a PDF here or <strong>click to browse</strong>
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Required for AI background context · Max 20 MB
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={resource.participantVisible}
                          onChange={(e) => updateResource(index, 'participantVisible', e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2" fontWeight={500}>
                            Show to attendees
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Appears in the Resources tab
                          </Typography>
                        </Box>
                      }
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={resource.required}
                          disabled={!resource.participantVisible}
                          onChange={(e) => updateResource(index, 'required', e.target.checked)}
                        />
                      }
                      label={
                        <Box>
                          <Typography
                            variant="body2"
                            fontWeight={500}
                            color={!resource.participantVisible ? 'text.disabled' : undefined}
                          >
                            Mark as required
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Shown in &quot;Required Reading&quot; section
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                </Box>
              ))}

              <Button variant="outlined" size="small" onClick={addResource}>
                + Add Resource
              </Button>
            </Box>
          )}

          {/* Navigation Buttons */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              disabled={activeStep === 0}
              onClick={handleBack}
              type="button"
              sx={{ mr: { xs: 1, sm: 0 } }}
            >
              Back
            </Button>

            {activeStep === steps.length - 1 ? (
              <Button
                type="button"
                variant="contained"
                disabled={formSubmitting}
                onClick={(e) => {
                  e.preventDefault();
                  if (formRef.current) sendData(new FormData(formRef.current));
                }}
                sx={{
                  ml: { xs: 1, sm: 0 },
                  fontSize: { xs: '0.75rem', sm: '0.875rem' },
                }}
              >
                {formSubmitting ? (
                  <>
                    <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                    Creating…
                  </>
                ) : (
                  'Create Conversation'
                )}
              </Button>
            ) : (
              <Button
                type="button"
                variant="contained"
                onClick={(e) => {
                  e.preventDefault();
                  handleNext();
                }}
                sx={{ ml: { xs: 1, sm: 0 } }}
              >
                Next
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </>
  );
};
