import { Dialog, DialogContent } from "@frontend/shadcn";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Heading, Text } from "@radix-ui/themes";
import QRCode from "qrcode.react";

interface AddCollateralProps {
  show: boolean;
  address: string;
  handleClose: () => void;
}

export function AddCollateralModal({
  show,
  address,
  handleClose,
}: AddCollateralProps) {
  return (
    <Dialog open={show}>
      <DialogContent
        onInteractOutside={handleClose}
        onEscapeKeyDown={handleClose}
        className="p-0"
      >
        <Box className="dark:bg-dark-700 bg-white rounded px-4 pt-7">
          <Box>
            <Heading
              as="h2"
              className="text-font dark:text-font-dark mb-7 text-center text-xl font-semibold md:text-2xl lg:text-3xl"
            >
              Add Collateral
            </Heading>
          </Box>
          <Box className="mb-3">
            <Box className="bg-blue-100 text-blue-800 p-3 rounded flex items-start gap-2">
              <FontAwesomeIcon icon={faInfoCircle} />
              <Text>
                You can top up your collateral at any point by paying to your
                collateral address.
              </Text>
            </Box>
          </Box>
          <Box className="mb-4">
            <div className="flex justify-center items-center flex-col">
              <QRCode value={address} size={200} />
              <p className="break-all text-font dark:text-font-dark mt-2 text-center">
                <strong className="text-sm">bitcoin:{address}</strong>
              </p>
            </div>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
