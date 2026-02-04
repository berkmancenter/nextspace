import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { CircularProgress } from "@mui/material";
import { CheckAuthHeader, getConversation } from "../../../../utils/Helpers";
import { AuthType } from "../../../../types.internal";

import { EventStatus } from "../../../../components";
import { Conversation } from "../../../../types.internal";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};

function EventScreen({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const { id } = router.query;

  const [conversationData, setConversationData] = useState<Conversation | null>(
    null
  );

  useEffect(() => {
    if (!id) return;

    const fetchConversationData = async () => {
      try {
        const data = await getConversation(id as string);
        setConversationData(data);
      } catch (error) {
        console.error("Error fetching thread data:", error);
      }
    };

    fetchConversationData();
  }, [id]);

  return (
    <div className="flex justify-center items-start">
      <div className="mt-12 w-2/3">
        {conversationData ? (
          <EventStatus conversationData={conversationData} />
        ) : (
          <div style={{ marginTop: 40 }}>
            <CircularProgress />
          </div>
        )}
      </div>
    </div>
  );
}

export default EventScreen;
