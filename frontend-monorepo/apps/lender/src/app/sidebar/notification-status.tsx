import {
  ChatMessage,
  ContractStatus,
  ContractUpdate,
  InstallmentStatus,
  InstallmentUpdate,
  NotificationMessage,
  NotificationMessageType,
  useLenderHttpClient,
  useNotifications,
} from "@frontend/http-client-lender";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCircleIcon,
  ChevronLeft,
  ChevronRight,
  InfoIcon,
  Loader2Icon,
  MessageCircle,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@frontend/shadcn";
import {
  differenceInMilliseconds,
  formatDistanceToNow,
  parseISO,
} from "date-fns";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { shortenUuid } from "../contracts/details";

interface InnerNotification {
  id: string;
  contractId: string;
  message: string;
  timestamp: Date;
  timestampReadable: string;
  read: boolean;
  originalType: NotificationMessageType;
  type: string;
}

const NOTIFICATIONS_PER_PAGE = 10;

const mapToInnerNotifications = (
  notifications: NotificationMessage[],
): InnerNotification[] => {
  return notifications.map(mapToInnerNotification);
};

const mapToInnerNotification = (
  notification: NotificationMessage,
): InnerNotification => {
  switch (notification.type) {
    case NotificationMessageType.ContractUpdate: {
      const update = notification.data as ContractUpdate;
      let message = "Contract update";
      console.log(`Contract status ${update.status}`);
      switch (update.status) {
        case ContractStatus.Requested:
        case ContractStatus.RenewalRequested:
          message = "A new contract has been requested";
          break;
        case ContractStatus.CollateralSeen:
          message = "Collateral has been found in mempool";
          break;
        case ContractStatus.CollateralConfirmed:
          message = "Contract has been funded";
          break;
        case ContractStatus.RepaymentProvided:
          message = "Contract has been repaid";
          break;
        case ContractStatus.Undercollateralized:
          message = "Contract is under collateralized";
          break;
        case ContractStatus.Defaulted:
          message = "Borrower defaulted on their contract";
          break;
        case ContractStatus.Closed:
        case ContractStatus.ClosedByLiquidation:
        case ContractStatus.ClosedByDefaulting:
          message = "Contract closed";
          break;
        case ContractStatus.DisputeBorrowerStarted:
        case ContractStatus.DisputeLenderStarted:
          message = "A dispute has been started";
          break;
        case ContractStatus.DisputeBorrowerResolved:
        case ContractStatus.DisputeLenderResolved:
          message = "A dispute has been resolved";
          break;
        case ContractStatus.Cancelled:
          message = "Contract request was cancelled";
          break;
        case ContractStatus.RequestExpired:
          message = "Contract request expired";
          break;
        case ContractStatus.ApprovalExpired:
          message = "Contract approval expired";
          break;
        case ContractStatus.Approved:
          message = "Contract has been approved";
          break;
        case ContractStatus.PrincipalGiven:
        case ContractStatus.RepaymentConfirmed:
        case ContractStatus.Closing:
        case ContractStatus.Extended:
        case ContractStatus.Rejected:
          break;
      }

      return {
        id: update.id,
        contractId: update.contract_id,
        message,
        read: update.read,
        originalType: notification.type,
        type: "info",
        timestamp: parseISO(update.timestamp),
        timestampReadable: formatDistanceToNow(update.timestamp, {
          addSuffix: true,
        }),
      };
    }
    case NotificationMessageType.InstallmentUpdate: {
      const update = notification.data as InstallmentUpdate;
      let message = "Installment update";
      console.log(`Installment status ${update.status}`);
      switch (update.status) {
        case InstallmentStatus.Cancelled:
          message = "An installment was cancelled";
          break;
        case InstallmentStatus.Pending:
          message = "An installment is now pending";
          break;
        case InstallmentStatus.Paid:
          message = "An installment was paid";
          break;
        case InstallmentStatus.Confirmed:
          message = "You confirmed an installment";
          break;
        case InstallmentStatus.Late:
          message = "An installment is now overdue";
          break;
      }

      return {
        id: update.id,
        contractId: update.contract_id,
        message,
        read: update.read,
        originalType: notification.type,
        type: "info",
        timestamp: parseISO(update.timestamp),
        timestampReadable: formatDistanceToNow(update.timestamp, {
          addSuffix: true,
        }),
      };
    }
    case NotificationMessageType.ChatMessage: {
      const chatMessage = notification.data as ChatMessage;
      return {
        id: chatMessage.id,
        contractId: chatMessage.contract_id,
        message: `${chatMessage.counterparty_name} has sent you a message`,
        read: chatMessage.read,
        originalType: notification.type,
        type: "message",
        timestamp: parseISO(chatMessage.timestamp),
        timestampReadable: formatDistanceToNow(chatMessage.timestamp, {
          addSuffix: true,
        }),
      };
    }
  }
};

export function NotificationStatus() {
  const { isConnected, onNotification } = useNotifications();
  const {
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationAsRead,
  } = useLenderHttpClient();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<InnerNotification[]>([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(true);
  const [isMarkingAllNotificationsAsRead, setIsMarkingAllNotificationsAsRead] =
    useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedInitially, setHasLoadedInitially] = useState(false);

  const navigate = useNavigate();

  // Fetch notifications with pagination
  const fetchNotificationsPage = useCallback(
    async (page: number, unreadOnly: boolean) => {
      if (isLoading) return;

      setIsLoading(true);
      try {
        // Update your fetchNotifications function to accept pagination parameters
        const response = await fetchNotifications(
          page,
          NOTIFICATIONS_PER_PAGE,
          unreadOnly,
        );
        const mapped = mapToInnerNotifications(response.data);

        if (page === 1) {
          // Replace notifications for first page
          setNotifications(mapped);
        } else {
          // Append for subsequent pages (if you want infinite scroll behavior)
          // Or replace for pagination behavior
          setNotifications(mapped);
        }

        setCurrentPage(response.page);
        setTotalPages(response.total_pages);
        setTotalNotifications(response.total);
        setHasLoadedInitially(true);
      } catch (error) {
        toast.error("Failed to fetch notifications");
        console.error("Failed to fetch notifications:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchNotifications, isLoading],
  );

  // Load initial notifications
  useEffect(() => {
    if (!hasLoadedInitially) {
      fetchNotificationsPage(1, showUnreadOnly);
    }
  }, [fetchNotificationsPage, hasLoadedInitially, showUnreadOnly]);

  // Handle real-time notifications
  useEffect(() => {
    return onNotification((newNotification) => {
      const mapped = mapToInnerNotification(newNotification);
      setNotifications((prevNotifications) => {
        // Add new notification to the beginning and remove duplicates
        return Array.from(
          new Map(
            [mapped, ...prevNotifications].map((item) => [item.id, item]),
          ).values(),
        );
      });

      // Update total count
      setTotalNotifications((prev) => prev + 1);
    });
  }, [onNotification]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const hasUnread = unreadCount > 0;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "info":
        return <InfoIcon />;
      case "message":
        return <MessageCircle />;
      default:
        return <AlertCircle />;
    }
  };

  const handleOnClick = async (notification: InnerNotification) => {
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
        setNotifications((prevNotifications) =>
          prevNotifications.map((n) =>
            n.id === notification.id ? { ...n, read: true } : n,
          ),
        );
      } catch (error) {
        toast.error(`Failed marking message as read ${error}`);
        console.log(`Failed marking message as read ${error}`);
      }
    }

    switch (notification.originalType) {
      case NotificationMessageType.ChatMessage:
        setIsOpen(false);
        navigate(`/my-contracts/${notification.contractId}`);
        break;
      case NotificationMessageType.ContractUpdate:
        setIsOpen(false);
        navigate(`/my-contracts/${notification.contractId}`);
        break;
      case NotificationMessageType.InstallmentUpdate:
        setIsOpen(false);
        navigate(`/my-contracts/${notification.contractId}`);
        break;
    }
  };

  const onMarkAllNotificationsAsRead = async () => {
    setIsMarkingAllNotificationsAsRead(true);
    try {
      await markAllNotificationAsRead();
      setNotifications((prevNotifications) =>
        prevNotifications.map((n) => ({ ...n, read: true })),
      );
      toast.success("Marked all notifications as read");
    } catch (error) {
      console.error(error);
      toast.error("Failed to mark all notifications as read");
    } finally {
      setIsMarkingAllNotificationsAsRead(false);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      fetchNotificationsPage(currentPage - 1, showUnreadOnly);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      fetchNotificationsPage(currentPage + 1, showUnreadOnly);
    }
  };

  const handleToggleFilter = (value: string) => {
    const newShowUnreadOnly = value === "unread";
    setShowUnreadOnly(newShowUnreadOnly);
    setCurrentPage(1);

    // Only call if we've loaded initially to prevent race conditions
    if (hasLoadedInitially) {
      fetchNotificationsPage(1, newShowUnreadOnly);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="hover:bg-accent ml-auto h-8 w-8 rounded-full p-0"
        >
          <div className="relative">
            {isConnected ? (
              hasUnread ? (
                <BellRing className="h-5 w-5 text-blue-600" />
              ) : (
                <Bell className="text-muted-foreground h-5 w-5" />
              )
            ) : (
              <Bell className="h-5 w-5 text-red-500" />
            )}
            {hasUnread && (
              <Badge
                variant="destructive"
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full p-0 text-xs"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </div>
        </Button>
      </SheetTrigger>

      <SheetContent className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
            {hasUnread && (
              <Badge variant="secondary" className="ml-auto">
                {unreadCount} new
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mx-2">
          <div className="flex flex-row items-center justify-between gap-2">
            <ToggleGroup
              value={showUnreadOnly ? "unread" : "all"}
              variant="outline"
              type="single"
              onValueChange={handleToggleFilter}
            >
              <ToggleGroupItem value="unread" aria-label="Show unread">
                <Label
                  htmlFor="unread"
                  className="mx-4 rounded-md px-3 text-sm font-medium"
                >
                  Unread
                </Label>
              </ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Show all">
                <Label
                  htmlFor="all"
                  className="mx-4 rounded-md px-3 text-sm font-medium"
                >
                  All
                </Label>
              </ToggleGroupItem>
            </ToggleGroup>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onMarkAllNotificationsAsRead}
                  disabled={isMarkingAllNotificationsAsRead}
                >
                  {isMarkingAllNotificationsAsRead ? (
                    <Loader2Icon className="animate-spin" />
                  ) : (
                    <CheckCircleIcon />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Mark all as read</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="mx-2">
          <ScrollArea className="h-[calc(100vh-200px)]">
            {isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2Icon className="text-muted-foreground h-8 w-8 animate-spin" />
                <p className="text-muted-foreground mt-2">
                  Loading notifications...
                </p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="text-muted-foreground mb-4 h-12 w-12" />
                <p className="text-muted-foreground">No notifications</p>
              </div>
            ) : (
              <div>
                {notifications
                  .filter((item) => {
                    if (showUnreadOnly) {
                      return !item.read;
                    } else {
                      return true;
                    }
                  })
                  .sort((a, b) => {
                    return differenceInMilliseconds(b.timestamp, a.timestamp);
                  })
                  .map((notification) => (
                    <div key={notification.id} className="my-2">
                      <Card
                        className={`hover:bg-accent/50 cursor-pointer transition-colors ${
                          !notification.read
                            ? "border-gray-200 bg-gray-200"
                            : ""
                        }`}
                        onClick={async (e) => {
                          e.preventDefault();
                          await handleOnClick(notification);
                        }}
                      >
                        <CardHeader>
                          <CardTitle>
                            <div className="flex items-center gap-3">
                              {getNotificationIcon(notification.type)}
                              <div className="flex">
                                <div className="mb-1 flex items-center gap-2">
                                  <h4 className="truncate text-sm font-medium">
                                    {notification.message}
                                  </h4>
                                  {!notification.read && (
                                    <div className="h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardTitle>
                          <CardDescription>
                            <div className="flex flex-row">
                              <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">
                                ID: {shortenUuid(notification.contractId)},
                                updated {notification.timestampReadable}
                              </p>
                            </div>
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </div>
                  ))}
              </div>
            )}
          </ScrollArea>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t py-4">
              <div className="text-muted-foreground text-sm">
                Page {currentPage} of {totalPages} ({totalNotifications}{" "}
                notifications total)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviousPage}
                  disabled={currentPage <= 1 || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
