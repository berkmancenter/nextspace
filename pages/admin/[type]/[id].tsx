import { useRouter } from "next/router";
import { Event } from "../../../components";
import { CheckAuthHeader } from "../../../utils/Helpers";
import { AuthType } from "../../../types.internal";

export const getServerSideProps = async (context: { req: any }) => {
  return CheckAuthHeader(context.req.headers);
};
function EventScreen({ authType }: { authType: AuthType }) {
  const router = useRouter();
  const { id, type } = router.query;

  return (
    <div className="flex items-start justify-center mt-12">
      {typeof id === "string" && (
        <Event
          id={id}
          experiment={type && type === "experiment" ? true : false}
        />
      )}
    </div>
  );
}

export default EventScreen;
