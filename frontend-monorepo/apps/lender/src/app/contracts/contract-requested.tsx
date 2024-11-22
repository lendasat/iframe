import { CreateWalletModal } from "@frontend-monorepo/browser-wallet";
import { Button, Dialog, Flex, Heading } from "@radix-ui/themes";

interface ContractRequestedProps {
  showCreateWalletModal: boolean;
  handleCloseCreateWalletModal: () => void;
  doesWalletExist: boolean;
  isLoading: boolean;
  onContractApprove: () => Promise<void>;
  onCreateWalletButtonClick: () => Promise<void>;
  onContractReject: () => Promise<void>;
}

export const ContractRequested = ({
  showCreateWalletModal,
  handleCloseCreateWalletModal,
  doesWalletExist,
  isLoading,
  onContractApprove,
  onCreateWalletButtonClick,
  onContractReject,
}: ContractRequestedProps) => {
  return (
    <div>
      <Heading weight={"medium"} size={"4"}>
        Awaiting Your Remark...
      </Heading>
      <div className="d-flex gap-2 mt-5">
        <CreateWalletModal
          show={showCreateWalletModal}
          handleClose={handleCloseCreateWalletModal}
          handleSubmit={handleCloseCreateWalletModal}
        />
        {/* Approve Button */}
        {doesWalletExist
          ? (
            <Dialog.Root>
              <Dialog.Trigger>
                <Button
                  color="green"
                  loading={isLoading}
                  disabled={isLoading}
                  size={"3"}
                >
                  Approve
                </Button>
              </Dialog.Trigger>
              <Dialog.Content maxWidth="450px">
                <Dialog.Title>Approval Contract</Dialog.Title>
                <Dialog.Description size="2" mb="4">
                  Are you sure you want to approve this loan?
                </Dialog.Description>
                <Flex gap="3" mt="4" justify="end">
                  <Dialog.Close>
                    <Button variant="soft" color="gray">
                      Quit
                    </Button>
                  </Dialog.Close>
                  <Dialog.Close>
                    <Button
                      color="green"
                      loading={isLoading}
                      disabled={isLoading}
                      onClick={onContractApprove}
                    >
                      Approve
                    </Button>
                  </Dialog.Close>
                </Flex>
              </Dialog.Content>
            </Dialog.Root>
          )
          : (
            <Button
              color="green"
              onClick={onCreateWalletButtonClick}
              size={"3"}
            >
              Create Bitcoin wallet
            </Button>
          )}

        {/* Reject Button */}
        <Dialog.Root>
          <Dialog.Trigger>
            <Button
              color="red"
              loading={isLoading}
              disabled={isLoading}
              size={"3"}
            >
              Reject
            </Button>
          </Dialog.Trigger>
          <Dialog.Content maxWidth="450px">
            <Dialog.Title>Reject Contract</Dialog.Title>
            <Dialog.Description size="2" mb="4">
              Are you sure you want to reject this loan?
            </Dialog.Description>
            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Quit
                </Button>
              </Dialog.Close>
              <Button
                color="red"
                loading={isLoading}
                disabled={isLoading}
                onClick={onContractReject}
              >
                Reject
              </Button>
            </Flex>
          </Dialog.Content>
        </Dialog.Root>
      </div>
    </div>
  );
};
