import { FC, useState, useRef, useEffect, KeyboardEvent } from "react";
import { Box, Button, Typography } from "@mui/material";
import {
  ThumbDownOutlined,
  AddCommentOutlined,
  Check,
} from "@mui/icons-material";
import { ControlledInputConfig } from "./DirectMessage";

/**
 * VisuallyHidden component for screen reader only content
 */
const VisuallyHidden: FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      border: "0",
    }}
  >
    {children}
  </span>
);

/**
 * Props for the MessageFeedback component
 */
interface MessageFeedbackProps {
  messageId?: string;
  onPopulateFeedbackText?: (config: ControlledInputConfig) => void;
  onSendFeedbackRating?: (messageId: string, rating: number) => void;
}

/**
 * MessageFeedback component
 *
 * This component renders the feedback UI for assistant messages, including
 * rating buttons (1-5), a thumbs down icon, and a custom "mind blown" SVG icon.
 */
export const MessageFeedback: FC<MessageFeedbackProps> = ({
  messageId,
  onPopulateFeedbackText,
  onSendFeedbackRating,
}) => {
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState<string>("");
  const [focusedRating, setFocusedRating] = useState<number | null>(null);
  const ratingButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleRatingClick = (rating: number) => {
    if (selectedRating !== null || !messageId || !onSendFeedbackRating) return;
    setSelectedRating(rating);
    setAnnouncement(`Rating ${rating} of 5 selected`);
    onSendFeedbackRating(messageId, rating);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    rating: number
  ) => {
    if (selectedRating !== null) return;

    let nextRating: number | null = null;

    switch (event.key) {
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        nextRating = rating > 1 ? rating - 1 : 5;
        break;
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        nextRating = rating < 5 ? rating + 1 : 1;
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        handleRatingClick(rating);
        return;
    }

    if (nextRating !== null) {
      setFocusedRating(nextRating);
      ratingButtonRefs.current[nextRating - 1]?.focus();
    }
  };

  useEffect(() => {
    // Clear announcement after it's been read
    if (announcement) {
      const timer = setTimeout(() => setAnnouncement(""), 1000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  const handleSayMoreClick = () => {
    if (!messageId || !onPopulateFeedbackText) return;
    onPopulateFeedbackText({
      prefix: `/ShareFeedback|Text|${messageId}|`,
      icon: <AddCommentOutlined fontSize="small" />,
      label: "Feedback Mode",
    });
  };

  if (!messageId || !onPopulateFeedbackText || !onSendFeedbackRating) {
    return null;
  }

  return (
    <Box display="flex" flexDirection="column" gap="0.5rem" marginTop="0.5rem">
      {/* Live region for announcements */}
      <div aria-live="polite" aria-atomic="true">
        <VisuallyHidden>{announcement}</VisuallyHidden>
      </div>

      {/* Header Row */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography
          variant="body2"
          id="rating-group-label"
          className="text-gray-600"
        >
          How did the bot do?
        </Typography>
        <Button
          size="small"
          endIcon={<AddCommentOutlined fontSize="small" aria-hidden="true" />}
          onClick={handleSayMoreClick}
          className="text-medium-slate-blue"
          aria-label="Provide additional feedback about this response"
          sx={{
            textTransform: "none",
            fontSize: "0.875rem",
            "&:hover": {
              backgroundColor: "rgba(72, 69, 210, 0.04)",
            },
          }}
        >
          Say more
        </Button>
      </Box>
      {/* Rating Row */}
      <Box
        display="flex"
        alignItems="center"
        gap="0.5rem"
        role="radiogroup"
        aria-labelledby="rating-group-label"
      >
        <ThumbDownOutlined
          className="text-gray-600"
          sx={{ fontSize: "1.25rem" }}
          aria-hidden="true"
        />
        {[1, 2, 3, 4, 5].map((rating) => (
          <Button
            key={rating}
            ref={(el) => {
              ratingButtonRefs.current[rating - 1] = el;
            }}
            variant="outlined"
            size="small"
            onClick={() => handleRatingClick(rating)}
            onKeyDown={(e) => handleKeyDown(e, rating)}
            disabled={selectedRating !== null}
            role="radio"
            aria-checked={selectedRating === rating}
            aria-label={`Rate ${rating} out of 5`}
            tabIndex={
              selectedRating !== null
                ? -1
                : focusedRating === rating ||
                  (focusedRating === null && rating === 1)
                ? 0
                : -1
            }
            className={
              selectedRating === rating
                ? "border-2 border-green-600 text-green-700 bg-green-100"
                : "border-2 border-gray-300 text-gray-700 bg-white"
            }
            sx={{
              minWidth: "36px",
              height: "36px",
              fontWeight: 600,
              "&:hover": {
                borderColor:
                  selectedRating === rating
                    ? "rgb(22 163 74)"
                    : "rgb(75 85 99)",
                backgroundColor:
                  selectedRating === rating
                    ? "rgb(220 252 231)"
                    : "rgb(243 244 246)",
                borderWidth: "2px",
              },
              "&:focus-visible": {
                outline: "2px solid rgb(59 130 246)",
                outlineOffset: "2px",
              },
              "&.Mui-disabled": {
                borderColor: "rgb(209 213 219)",
                color: "rgb(156 163 175)",
                backgroundColor: "white",
                borderWidth: "2px",
              },
            }}
          >
            {selectedRating === rating ? (
              <Check fontSize="small" aria-hidden="true" />
            ) : (
              rating
            )}
          </Button>
        ))}
        <svg
          width="28"
          height="27"
          viewBox="0 0 28 27"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          role="img"
        >
          <path
            d="M13.9907 20.1083V10.4903M13.9907 20.1083C13.9907 18.1767 15.5566 16.6108 17.4882 16.6108M13.9907 20.1083C13.9907 18.1767 12.4248 16.6108 10.4933 16.6108M13.9907 20.1083C13.9907 20.9826 14.11 21.3064 14.4279 21.857C15.273 23.3207 17.1446 23.8222 18.6083 22.9771C19.9505 22.2022 20.4836 20.5642 19.9113 19.1689C21.5202 18.8546 22.7343 17.4373 22.7343 15.7365C22.7343 13.8049 21.1685 12.239 19.2369 12.239L19.2369 10.4903C19.2369 9.04159 18.0625 7.86719 16.6138 7.86719C15.1651 7.86719 13.9907 9.04159 13.9907 10.4903M13.9907 20.1083C13.9907 20.9826 13.8714 21.3064 13.5535 21.857C12.7085 23.3207 10.8368 23.8222 9.37312 22.9771C8.03095 22.2022 7.49783 20.5642 8.07011 19.1689C6.46124 18.8546 5.2471 17.4373 5.2471 15.7365C5.2471 13.8049 6.81296 12.239 8.74455 12.239L8.74453 10.4903C8.74453 9.04159 9.91893 7.86719 11.3676 7.86719C12.8163 7.86719 13.9907 9.04159 13.9907 10.4903"
            stroke="black"
            strokeOpacity="0.5"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M27.9118 8.02578C27.8236 7.8737 27.6788 7.76273 27.509 7.71717C27.3393 7.67162 27.1584 7.69518 27.0059 7.78271L24.3653 9.3076C24.2865 9.34929 24.2168 9.40646 24.1605 9.47568C24.1042 9.54491 24.0625 9.62477 24.0377 9.7105C24.013 9.79623 24.0059 9.88606 24.0166 9.97463C24.0274 10.0632 24.056 10.1487 24.1006 10.226C24.1451 10.3032 24.2049 10.3707 24.2761 10.4244C24.3474 10.4781 24.4287 10.5169 24.5153 10.5384C24.6019 10.5599 24.692 10.5638 24.7801 10.5497C24.8682 10.5356 24.9525 10.5039 25.0281 10.4565L27.6687 8.93163C27.8208 8.84349 27.9317 8.69868 27.9773 8.5289C28.0228 8.35913 27.9993 8.17822 27.9118 8.02578ZM19.8484 5.94043C20.0009 6.02823 20.182 6.05195 20.352 6.00639C20.522 5.96082 20.6669 5.84968 20.7551 5.69735L22.28 3.05678C22.3602 2.90493 22.3785 2.72788 22.3309 2.56285C22.2833 2.39782 22.1736 2.25766 22.0248 2.17184C21.8761 2.08602 21.6998 2.06122 21.5331 2.10265C21.3665 2.14408 21.2223 2.24852 21.1311 2.39401L19.6062 5.03459C19.5186 5.18692 19.4949 5.36775 19.5403 5.53751C19.5857 5.70727 19.6964 5.85214 19.8484 5.94043ZM14.0111 4.37619C14.1871 4.37596 14.3557 4.30597 14.4801 4.18156C14.6045 4.05715 14.6745 3.88849 14.6748 3.71255V0.663642C14.6748 0.487633 14.6048 0.318833 14.4804 0.194376C14.3559 0.0699193 14.1871 0 14.0111 0C13.8351 0 13.6663 0.0699193 13.5419 0.194376C13.4174 0.318833 13.3475 0.487633 13.3475 0.663642V3.71255C13.3475 3.88864 13.4174 4.05753 13.5418 4.18212C13.6662 4.30672 13.835 4.37596 14.0111 4.37619ZM7.26715 5.69735C7.35762 5.84474 7.50205 5.95098 7.66969 5.99347C7.83733 6.03596 8.01493 6.01133 8.16467 5.92483C8.31442 5.83833 8.42449 5.6968 8.47145 5.53036C8.5184 5.36392 8.49853 5.18572 8.41607 5.03371L6.89118 2.39313C6.8479 2.31701 6.78999 2.2502 6.72077 2.19656C6.65156 2.14292 6.57241 2.1035 6.4879 2.08059C6.40338 2.05768 6.31517 2.05172 6.22834 2.06305C6.14151 2.07439 6.05778 2.10279 5.98198 2.14664C5.90617 2.19048 5.8398 2.24889 5.78668 2.3185C5.73355 2.38811 5.69473 2.46755 5.67245 2.55224C5.65016 2.63692 5.64486 2.72518 5.65684 2.81192C5.66883 2.89866 5.69786 2.98218 5.74226 3.05765L7.26715 5.69735ZM3.65691 9.3076L1.01633 7.78271C0.940748 7.7353 0.856385 7.70361 0.76828 7.68954C0.680175 7.67547 0.590138 7.67931 0.503552 7.70084C0.416966 7.72236 0.335609 7.76112 0.264345 7.8148C0.193081 7.86848 0.133373 7.93599 0.0887903 8.01327C0.0442081 8.09055 0.0156672 8.17603 0.00487391 8.2646C-0.00591934 8.35316 0.00125669 8.443 0.025973 8.52873C0.0506893 8.61445 0.0924384 8.69432 0.148724 8.76355C0.20501 8.83277 0.274677 8.88994 0.353559 8.93163L2.99414 10.4565C3.06968 10.5029 3.15375 10.5337 3.24139 10.547C3.32902 10.5604 3.41844 10.556 3.50437 10.5342C3.59029 10.5125 3.67099 10.4737 3.74168 10.4202C3.81238 10.3667 3.87165 10.2996 3.91598 10.2229C3.96032 10.1461 3.98883 10.0612 3.99983 9.97329C4.01083 9.88533 4.0041 9.79606 3.98004 9.71075C3.95597 9.62543 3.91505 9.5458 3.8597 9.47656C3.80436 9.40732 3.73482 9.34987 3.65691 9.3076Z"
            fill="black"
            fillOpacity="0.5"
          />
        </svg>
      </Box>
    </Box>
  );
};
