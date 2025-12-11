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

/**
 * EventCreationForm component
 *
 * Displays the Event Creation form.
 * Allows users to create an event, choosing the platform, conversation type (and its configuration), and providing the Zoom meeting information
 * @returns A React component displaying the Event Creation form.
 */
export const EventCreationForm: React.FC = ({}) => {
  const router = useRouter();

  const [eventNameHasError, setEventNameHasError] = useState<boolean>(false);

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

  // Zoom Meeting URL pattern from environment variable or fallback regex
  const zoomMeetingUrlPattern = process.env.NEXT_PUBLIC_ZOOM_URL_PATTERN
    ? new RegExp(process.env.NEXT_PUBLIC_ZOOM_URL_PATTERN)
    : /https:\/\/[\w-]*\.?zoom.us\/.*/g;
  const zoomUrlDomain = process.env.NEXT_PUBLIC_ZOOM_DOMAIN || "zoom.us";
  const zoomUrlDomainError = `Invalid Zoom Meeting URL format ${
    zoomUrlDomain ? `(must use ${zoomUrlDomain})` : ""
  }.`;

  const [botName, setBotName] = useState<string | null>(null);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [conversationData, setConversationData] = useState<Conversation | null>(
    null
  );

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

  const formIsValid = (formData: FormData) => {
    // Check that required fields are present
    if (!formData.get("name")) {
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
    if (!zoomMeetingUrl.match(zoomMeetingUrlPattern)) {
      setFormError(zoomUrlDomainError);
      setFieldFocus("zoomMeetingUrl");
      return false;
    }

    // Check that at least one platform is selected
    if (selectedPlatforms.length === 0) {
      setFormError("At least one platform must be selected");
      return false;
    }

    // Check that agent is selected
    if (!selectedConvType) {
      setFormError("At least one agent must be selected");
      return false;
    }

    // Check form validity using HTML validation
    if (!formRef.current?.checkValidity()) {
      setFormError("Please fill out all required fields.");
      return false;
    }

    setFormError(null);
    return true;
  };

  const sendData = (formData: FormData) => {
    // Validate form data
    if (!formIsValid(formData)) return;

    let body: any = {
      name: formData.get("name"),
      ...(zoomMeetingTime && { scheduledTime: zoomMeetingTime }),
      platforms: selectedPlatforms,
      type: selectedConvType,
      topicId: process.env.NEXT_PUBLIC_DEFAULT_TOPIC_ID,
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
          router.push(`/admin/event/view/${data.id}`);
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
          <Typography variant="h5" component="h2" gutterBottom>
            Event Details
          </Typography>
          <TextField
            name="name"
            label="Event Name"
            id="thread-name"
            required
            fullWidth
            variant="outlined"
            margin="normal"
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
            fullWidth
            label="Zoom Meeting URL"
            name="zoomMeetingUrl"
            id="zoom-meeting-url"
            value={zoomMeetingUrl}
            onChange={(e) => setZoomMeetingUrl(e.target.value)}
            onBlur={() =>
              // Check format on unfocus
              setZoomMeetingUrlHasError(
                !zoomMeetingUrl ||
                  zoomMeetingUrl.length < 10 ||
                  (zoomMeetingUrl.length > 0 &&
                    !zoomMeetingUrl.match(zoomMeetingUrlPattern))
              )
            }
            error={zoomMeetingUrlHasError}
            helperText={
              zoomMeetingUrlHasError
                ? zoomMeetingUrl.length > 0 &&
                  !zoomMeetingUrl.match(zoomMeetingUrlPattern)
                  ? zoomUrlDomainError
                  : "Enter the Zoom Meeting URL for transcription purposes."
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

          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Conversation Configuration
            </Typography>
            {/* Platform Selection */}
            <FormControl
              component="fieldset"
              fullWidth
              margin="normal"
              id="platforms-select"
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
                Where do you want your audience to interact?
              </FormLabel>
              <FormGroup sx={{ mt: -1 }}>
                {(availablePlatforms || []).map((platform) => (
                  <FormControlLabel
                    key={platform.name}
                    control={
                      <Checkbox
                        checked={selectedPlatforms.indexOf(platform.name) > -1}
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
                Agent that you will be using
              </FormLabel>
              <RadioGroup
                value={selectedConvType}
                name="selectedConvType"
                onChange={(e) => {
                  setSelectedConvType(e.target.value);
                }}
                sx={{ mt: -1 }}
              >
                {(conversationTypes || []).map((option, index) => (
                  <div key={option.name}>
                    <FormControlLabel
                      value={option.name}
                      control={<Radio required={index === 0} />} // ← Makes validation work
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
          {/* Agent Configuration Forms */}
          {selectedConvType && (
            <Box sx={{ mt: 4 }}>
              <Typography variant="h5" component="h2" gutterBottom>
                Agent Configuration (Advanced Settings)
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

          <Box sx={{ mt: 4, textAlign: "right" }}>
            <Button
              type="submit"
              variant="outlined"
              onClick={(e) => {
                e.preventDefault();
                if (formRef.current) sendData(new FormData(formRef.current));
              }}
            >
              Create Conversation
            </Button>
          </Box>
        </Box>
      </Paper>
    </>
  );
};
