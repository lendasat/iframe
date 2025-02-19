import { LoanOffer } from "@frontend-monorepo/http-client-borrower";
import { Button, Checkbox, Dialog, Flex, Link, Text } from "@radix-ui/themes";
interface KycDialogProps {
  selectedOffer: LoanOffer;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
}

export function KycDialog({
  selectedOffer,
  checked,
  onCheckedChange,
  onConfirm,
}: KycDialogProps) {
  return (
    <Dialog.Root>
      <Dialog.Trigger>
        <Button color={"purple"} mt={"3"}>
          KYC Form
        </Button>
      </Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: "450px" }}>
        <Flex direction="column" gap="4">
          <Dialog.Title>KYC Required</Dialog.Title>

          <Text as="p">
            For this offer KYC is required. KYC verification is performed by the
            lender and we do not know if you have processed or succeeded KYC
            with them in the past.
          </Text>

          <Flex justify="center" py="4">
            <Link
              href={selectedOffer?.kyc_link}
              target="_blank"
              rel="noopener noreferrer"
              weight="medium"
            >
              Access KYC Form →
            </Link>
          </Flex>

          <Text as="p">
            If this is your first time requesting from this lender, please
            proceed to their KYC form to initiate the procedure.
          </Text>

          <Text as="p">
            Meanwhile, you can continue requesting the offer through Lendasat.
            Once the KYC request has been approved, the Lender will accept your
            loan request.
          </Text>

          <Flex gap="2" align="center">
            <Checkbox
              checked={checked}
              onCheckedChange={onCheckedChange}
              id="kyc-confirm"
            />
            <Text as="label" htmlFor="kyc-confirm">
              I confirm I've submitted the KYC
            </Text>
          </Flex>

          <Flex gap="3" justify="end" mt="4">
            <Dialog.Close>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </Dialog.Close>
            <Dialog.Close>
              <Button disabled={!checked} onClick={onConfirm}>
                Confirm
              </Button>
            </Dialog.Close>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
