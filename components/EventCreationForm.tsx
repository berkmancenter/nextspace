"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { useRouter } from "next/router";
import { Request } from "../utils";
import { EventStatus } from "./";
import { components } from "../types";
import { Conversation } from "../types.internal";
import { createConversationFromData, Api } from "../utils/Helpers";
import { useField } from "@mui/x-date-pickers/internals";

const steps = [
  "Event Details",
  "Conversation Configuration",
  "Agent Configuration",
  "Moderators & Speakers",
];

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
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [activeStep, setActiveStep] = useState(0);

  const [eventNameHasError, setEventNameHasError] = useState<boolean>(false);
  const [eventName, setEventName] = useState<string>("");
  const [eventDescription, setEventDescription] = useState<string>("");

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [selectedConvType, setSelectedConvType] = useState<string | null>(null);
  const [supportedModels, setSupportedModels] = useState<
    components["schemas"]["LlmModelDetails"][] | null
  >(null);
  const [availablePlatforms, setAvailablePlatforms] = useState<
    components["schemas"]["PlatformConfig"][] | null
  >(null);
  const [conversationTypes, setConversationTypes] = useState<
    components["schemas"]["ConversationType"][] | null
  >(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [zoomMeetingUrl, setZoomMeetingUrl] = useState<string>("");
  const [zoomMeetingUrlHasError, setZoomMeetingUrlHasError] =
    useState<boolean>(false);
  const [zoomMeetingTime, setZoomMeetingTime] = useState<string>("");

  const [botName, setBotName] = useState<string | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conversationData, setConversationData] = useState<Conversation | null>(
    null
  );

  const [formGroupsErrors, setFormGroupsErrors] = useState({
    platforms: false,
    conversationType: false,
  });
  const [platformsPreviouslyChecked, setPlatformsPreviouslyChecked] =
    useState(false);

  // Moderators and Speakers state
  const [moderators, setModerators] = useState<
    Array<{ name: string; bio: string }>
  >([{ name: "", bio: "" }]);
  const [speakers, setSpeakers] = useState<
    Array<{ name: string; bio: string }>
  >([{ name: "", bio: "" }]);
  const [showModerators, setShowModerators] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement>(null);

  const setFieldFocus = (fieldName: string) => {
    (formRef.current?.elements.namedItem(fieldName) as HTMLElement)?.focus();
  };

  useEffect(() => {
    if (selectedConvType) {
      const type = conversationTypes?.find((a) => a.name === selectedConvType);
      if (type) {
        setBotName(type.label || type.name);
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
        const { supportedModels, availablePlatforms, conversationTypes } =
          config;

        setSupportedModels(supportedModels);
        setAvailablePlatforms(availablePlatforms);
        setConversationTypes(conversationTypes);

        // Set default selected model
        if (supportedModels && supportedModels.length > 0) {
          setSelectedModel(supportedModels[0].name);
        }
      } catch (error) {
        setFormError("Failed to load configuration.");
      }
    }

    if (!supportedModels || !availablePlatforms || !conversationTypes)
      fetchServerConfig();
  }, [supportedModels, availablePlatforms, conversationTypes]);

  const validateStep1 = () => {
    // Check that required fields are present
    if (!eventName || eventName.trim() === "") {
      setFormError("Event Name is required");
      setFieldFocus("name");
      return false;
    }

    // Check zoom fields
    if (!zoomMeetingUrl) {
      setFormError("Zoom Meeting URL is required");
      setFieldFocus("zoomMeetingUrl");
      return false;
    }

    setFormError(null);
    return true;
  };

  const validateStep2 = () => {
    // Check that at least one platform is selected
    if (selectedPlatforms.length === 0) {
      setFormError("At least one platform must be selected");
      setFieldFocus("nextspace");
      setFormGroupsErrors((prev) => ({ ...prev, platforms: true }));
      return false;
    }

    // Check that agent is selected
    if (!selectedConvType) {
      setFormError("At least one agent must be selected");
      setFieldFocus("agent-option-0");
      setFormGroupsErrors((prev) => ({ ...prev, conversationType: true }));
      return false;
    }

    // Check form validity using HTML validation
    if (!formRef.current?.checkValidity()) {
      setFormError("Please fill out all required fields.");
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
    setModerators([...moderators, { name: "", bio: "" }]);
  };

  const removeModerator = (index: number) => {
    if (moderators.length > 1) {
      setModerators(moderators.filter((_, i) => i !== index));
    }
  };

  const updateModerator = (
    index: number,
    field: "name" | "bio",
    value: string
  ) => {
    const updated = [...moderators];
    updated[index][field] = value;
    setModerators(updated);
  };

  // Speaker management functions
  const addSpeaker = () => {
    setSpeakers([...speakers, { name: "", bio: "" }]);
  };

  const removeSpeaker = (index: number) => {
    if (speakers.length > 1) {
      setSpeakers(speakers.filter((_, i) => i !== index));
    }
  };

  const updateSpeaker = (
    index: number,
    field: "name" | "bio",
    value: string
  ) => {
    const updated = [...speakers];
    updated[index][field] = value;
    setSpeakers(updated);
  };

  const handleNext = () => {
    if (activeStep === 0 && !validateStep1()) {
      return;
    }
    if (activeStep === 1 && !validateStep2()) {
      return;
    }
    if (activeStep === 2 && !validateStep3()) {
      return;
    }
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setFormError(null);
  };

  const sendData = (formData: FormData) => {
    // Validate step 3 before submission (though it's currently always valid)
    if (!validateStep3()) return;

    // Filter out empty moderators and speakers
    const validModerators = showModerators
      ? moderators.filter((m) => m.name.trim() !== "" || m.bio.trim() !== "")
      : [];
    const validSpeakers = speakers.filter(
      (s) => s.name.trim() !== "" || s.bio.trim() !== ""
    );

    let body: any = {
      name: eventName,
      ...(eventDescription && { description: eventDescription }),
      ...(zoomMeetingTime && { scheduledTime: zoomMeetingTime }),
      platforms: selectedPlatforms,
      type: selectedConvType,
      topicId: process.env.NEXT_PUBLIC_DEFAULT_TOPIC_ID,
      ...(validModerators.length > 0 && { moderators: validModerators }),
      ...(validSpeakers.length > 0 && { presenters: validSpeakers }),
    };

    const model = supportedModels!.find(
      (model) => model.name === selectedModel
    )!;
    // TODO dynamically create form and set values based on the properties of each conversation type
    // For now, we know both types have the same properties, so is hardcoded
    const properties = {
      zoomMeetingUrl,
      ...(botName && { botName }),
      llmModel: { llmModel: model.llmModel, llmPlatform: model.llmPlatform },
    };

    body = {
      ...body,
      properties,
    };

    Request("conversations/from-type", body)
      .then((data) => {
        if (!data) {
          setFormError("Failed to send data. Please try again.");
          return;
        }
        if ("error" in data) {
          setFormError(
            data.message?.message || "Failed to create conversation."
          );
          return;
        }
        createConversationFromData(data).then((conversation) => {
          setConversationData(conversation);
          setFormSubmitted(true);
        });
      })
      .catch((error) => {
        console.error("Error sending data:", error);
        setFormError(`Failed to send data. (${error.message})`);
      });
  };

  if (formSubmitted && conversationData) {
    return <EventStatus conversationData={conversationData} />;
  }

  return (
    <>
      <Typography variant="h4" className="text-center" gutterBottom>
        Create Event
      </Typography>
      <Paper
        elevation={3}
        sx={{ p: 4, maxWidth: 800, mx: "auto", mt: 4, mb: 4 }}
      >
        {isMobile ? (
          <MobileStepper
            variant="dots"
            steps={steps.length}
            position="static"
            activeStep={activeStep}
            sx={{
              mb: 2,
              justifyContent: "center",
              background: "transparent",
            }}
            nextButton={<span />}
            backButton={<span />}
          />
        ) : (
          <Stepper
            activeStep={activeStep}
            orientation="horizontal"
            sx={{ mb: 4 }}
          >
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
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
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
                helperText={
                  eventNameHasError ? "Enter a name for your event." : null
                }
                onBlur={() =>
                  setEventNameHasError(
                    !formRef.current?.elements.namedItem("name") ||
                      !(
                        formRef.current.elements.namedItem(
                          "name"
                        ) as HTMLInputElement
                      ).value
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

              <TextField
                name="zoomUrl"
                label="Zoom Meeting URL"
                id="zoom-url"
                value={zoomMeetingUrl}
                fullWidth
                onChange={(e) => setZoomMeetingUrl(e.target.value)}
                onBlur={() =>
                  // Check format on unfocus
                  setZoomMeetingUrlHasError(
                    !zoomMeetingUrl || zoomMeetingUrl.length < 10
                  )
                }
                error={zoomMeetingUrlHasError}
                helperText={
                  zoomMeetingUrlHasError
                    ? "Enter the Zoom Meeting URL for transcription purposes."
                    : null
                }
                variant="outlined"
                margin="normal"
                required
              />

              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DateTimePicker
                  label="Meeting Day/Time"
                  onChange={(newValue) =>
                    setZoomMeetingTime(
                      newValue?.isValid() ? newValue?.toISOString() : ""
                    )
                  }
                  slotProps={{
                    textField: {
                      margin: "normal",
                      fullWidth: true,
                      helperText:
                        "Enter the meeting start time if it begins more than 15 minutes from now.",
                    },
                  }}
                />
              </LocalizationProvider>
            </Box>
          )}

          {/* Step 2: Conversation Configuration */}
          {activeStep === 1 && (
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Conversation Configuration
              </Typography>

              {/* Platform Selection */}
              <FormControl
                component="fieldset"
                fullWidth
                margin="normal"
                sx={{
                  border: formGroupsErrors.platforms
                    ? "2px solid red"
                    : "1px solid rgba(0, 0, 0, 0.23)",
                  borderRadius: 1,
                  p: 2,
                  "&:focus-within": {
                    borderColor: "primary.main",
                    borderWidth: "2px",
                  },
                }}
              >
                <FormLabel
                  component="legend"
                  sx={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "rgba(0, 0, 0, 0.87)",
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
                          checked={
                            selectedPlatforms.indexOf(platform.name) > -1
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPlatforms([
                                ...selectedPlatforms,
                                platform.name,
                              ]);
                            } else {
                              setSelectedPlatforms(
                                selectedPlatforms.filter(
                                  (item) => item !== platform.name
                                )
                              );
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
                  border: formGroupsErrors.conversationType
                    ? "2px solid red"
                    : "1px solid rgba(0, 0, 0, 0.23)",
                  borderRadius: 1,
                  p: 2,
                  "&:focus-within": {
                    borderColor: "primary.main",
                    borderWidth: "2px",
                  },
                }}
              >
                <FormLabel
                  component="legend"
                  sx={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "rgba(0, 0, 0, 0.87)",
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
                                "& .MuiFormControlLabel-asterisk": {
                                  display: "none",
                                },
                              }
                            : {}
                        }
                      />
                      <div className="text-gray-600 text-sm ml-8 -mt-2">
                        {option.description}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
            </Box>
          )}

          {/* Step 3: Agent Configuration */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h5" component="h2" gutterBottom>
                Agent Configuration
              </Typography>
              <FormControl
                component="fieldset"
                fullWidth
                margin="normal"
                sx={{
                  border: "1px solid rgba(0, 0, 0, 0.23)",
                  borderRadius: 1,
                  p: 2,
                  "&:focus-within": {
                    borderColor: "primary.main",
                    borderWidth: "2px",
                  },
                }}
              >
                <FormLabel
                  component="legend"
                  sx={{
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    color: "rgba(0, 0, 0, 0.87)",
                  }}
                >
                  Model that your agent will use
                </FormLabel>
                <RadioGroup
                  value={selectedModel}
                  name="selectedModel"
                  onChange={(e) => {
                    setSelectedModel(e.target.value);
                  }}
                  sx={{ mt: -1 }}
                >
                  {(supportedModels || []).map((option) => (
                    <div key={option.name}>
                      <FormControlLabel
                        value={option.name}
                        control={<Radio />}
                        label={option.label}
                      />
                      <div className="text-gray-600 text-sm ml-8 -mt-2">
                        {option.description}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <TextField
                name="zoomBotName"
                label="Zoom Bot Name"
                id="zoom-bot-name"
                value={botName || ""}
                helperText="Enter the display name for the bot as it will appear in Zoom."
                fullWidth
                variant="outlined"
                margin="normal"
                onChange={(e) => setBotName(e.target.value)}
              />
            </Box>
          )}

          {/* Step 4: Moderators & Speakers */}
          {activeStep === 3 && (
            <Box sx={{ maxHeight: "600px", overflowY: "auto", pr: 1 }}>
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
                    border: "1px solid rgba(0, 0, 0, 0.12)",
                    borderRadius: 1,
                    position: "relative",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle2" color="text.secondary">
                      Speaker {index + 1}
                    </Typography>
                    {speakers.length > 1 && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeSpeaker(index)}
                      >
                        Remove
                      </Button>
                    )}
                  </Box>
                  <TextField
                    label="Name"
                    value={speaker.name}
                    onChange={(e) =>
                      updateSpeaker(index, "name", e.target.value)
                    }
                    fullWidth
                    variant="outlined"
                    margin="normal"
                  />
                  <TextField
                    label="Bio"
                    value={speaker.bio}
                    onChange={(e) =>
                      updateSpeaker(index, "bio", e.target.value)
                    }
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
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                  }}
                >
                  <Typography
                    variant="h5"
                    component="h2"
                    gutterBottom
                    sx={{ mb: 0 }}
                  >
                    About the Moderators
                  </Typography>

                  {showModerators && (
                    <Button
                      size="small"
                      onClick={() => {
                        setShowModerators(false);
                        setModerators([{ name: "", bio: "" }]);
                      }}
                    >
                      Remove All
                    </Button>
                  )}
                </Box>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
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
                          border: "1px solid rgba(0, 0, 0, 0.12)",
                          borderRadius: 1,
                          position: "relative",
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            mb: 1,
                          }}
                        >
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            Moderator {index + 1}
                          </Typography>
                          {moderators.length > 1 && (
                            <Button
                              size="small"
                              color="error"
                              onClick={() => removeModerator(index)}
                            >
                              Remove
                            </Button>
                          )}
                        </Box>
                        <TextField
                          label="Name"
                          value={moderator.name}
                          onChange={(e) =>
                            updateModerator(index, "name", e.target.value)
                          }
                          fullWidth
                          variant="outlined"
                          margin="normal"
                          placeholder="Enter moderator's name"
                        />
                        <TextField
                          label="Bio"
                          value={moderator.bio}
                          onChange={(e) =>
                            updateModerator(index, "bio", e.target.value)
                          }
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
                  {showModerators
                    ? "+ Add Another Moderator"
                    : "+ Add Moderators"}
                </Button>
              </Box>
            </Box>
          )}

          {/* Navigation Buttons */}
          <Box sx={{ mt: 4, display: "flex", justifyContent: "space-between" }}>
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
                onClick={(e) => {
                  e.preventDefault();
                  if (formRef.current) sendData(new FormData(formRef.current));
                }}
                sx={{
                  ml: { xs: 1, sm: 0 },
                  fontSize: { xs: "0.75rem", sm: "0.875rem" },
                }}
              >
                Create Conversation
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
