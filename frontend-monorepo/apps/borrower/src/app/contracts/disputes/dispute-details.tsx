import React, { useState } from "react";
import { format } from "date-fns";
import {
  ContractDisputeMessage,
  ContractDisputeStatus,
  DisputeWithMessages,
  useAuth,
  useHttpClientBorrower,
} from "@frontend/http-client-borrower";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  ScrollArea,
  Textarea,
} from "@frontend/shadcn";
import {
  formatInitiatorType,
  formatSenderType,
  formatStatus,
  getStatusColor,
} from "./disputes";
import { LuCircleCheck, LuLoader, LuPlus } from "react-icons/lu";
import { useNavigate } from "react-router-dom";

interface DisputeDetailsProps {
  dispute: DisputeWithMessages;
}

export const DisputeDetails: React.FC<DisputeDetailsProps> = ({ dispute }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [newComment, setNewComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const { commentOnDispute, resolveDispute } = useHttpClientBorrower();

  const handleSendMessage = async () => {
    if (!newComment.trim()) return;

    try {
      setIsSending(true);
      await commentOnDispute(dispute.id, newComment);
      navigate(0);
      setNewComment("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const isOwnMessage = (msg: ContractDisputeMessage) => {
    return msg.sender_id === user?.id;
  };

  // Function to handle resolving a dispute
  const handleResolveDispute = async (disputeId: string) => {
    try {
      setIsResolving(true);
      await resolveDispute(disputeId);
      navigate(0);
    } catch (error) {
      console.error(`Failed to resolve dispute: ${error}`);
    } finally {
      setIsResolving(false);
    }
  };

  const isResolved =
    dispute.status === ContractDisputeStatus.Cancelled ||
    dispute.status === ContractDisputeStatus.Closed;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle>Dispute Details</CardTitle>
          <Badge className={`${getStatusColor(dispute.status)} text-white`}>
            {formatStatus(dispute.status)}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        <div className="space-y-2 bg-slate-50 p-3 rounded mb-4">
          <div>
            <strong>Initiated By:</strong>{" "}
            {formatInitiatorType(dispute.initiator_type)}
          </div>
          <div>
            <strong>Created:</strong>{" "}
            {format(dispute.created_at || new Date(), "PPP p")}
          </div>
          <div>
            <strong>Reason:</strong>{" "}
            <p className="mt-1 border rounded p-2 bg-white">{dispute.reason}</p>
          </div>
          {dispute.resolution_notes && (
            <div>
              <strong>Resolution Notes:</strong>
              <p className="mt-1 border rounded p-2 bg-white">
                {dispute.resolution_notes}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 min-h-0">
          <h4 className="text-sm font-medium mb-2">Comment History</h4>
          {!dispute.messages || dispute.messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border rounded">
              No comments yet.
            </div>
          ) : (
            <ScrollArea className="h-[220px] rounded border p-4">
              <div className="space-y-4">
                {dispute.messages.map((message) => {
                  const ownMessage = isOwnMessage(message);

                  return (
                    <div
                      key={message.id}
                      className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          ownMessage
                            ? "bg-black text-white"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        <div className="text-xs mb-1">
                          {ownMessage
                            ? "You"
                            : formatSenderType(message.sender_type)}
                          <span className="ml-2 opacity-75">
                            {format(message.created_at, "p")}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap break-words">
                          {message.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>

      {!isResolved && (
        <CardFooter className="flex-col items-stretch pt-0">
          <h4 className="text-sm font-medium mb-2">Add a Comment</h4>
          <div className="flex w-full items-center space-x-2">
            <Textarea
              placeholder="Type your comment here..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
              className="resize-none w-full"
            />
            {/* For mobile (xs) screens */}
            <div className="sm:hidden">
              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={!newComment.trim() || isSending}
                size="icon"
                className="flex items-center justify-center"
              >
                {isSending ? (
                  <LuLoader className="h-4 w-4 animate-spin" />
                ) : (
                  <LuPlus />
                )}
              </Button>
            </div>

            {/* For sm screens and above */}
            <div className="hidden sm:block">
              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={!newComment.trim() || isSending}
                size="default"
                className="flex items-center justify-center"
              >
                {isSending ? (
                  <>
                    <LuLoader className="mr-2 h-4 w-4 animate-spin" />
                    Please wait
                  </>
                ) : (
                  <>
                    <LuPlus className="mr-2" />
                    Add Comment
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            {!dispute.status?.includes("resolved") &&
              dispute.status ===
                ContractDisputeStatus.DisputeStartedBorrower && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button>Resolve Dispute</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Resolve Dispute</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to mark this dispute as resolved?
                        Normal functionality will resume.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <Button
                          onClick={() => handleResolveDispute(dispute.id)}
                          disabled={isResolving}
                          className="ml-2"
                        >
                          <LuCircleCheck className="mr-2 h-4 w-4" />
                          {isResolving ? "Resolving..." : "Resolve Dispute"}
                        </Button>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
};
