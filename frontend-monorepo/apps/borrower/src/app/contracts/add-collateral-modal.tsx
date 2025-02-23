import { Alert, Modal } from "react-bootstrap";

import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Box, Flex, Heading, Text } from "@radix-ui/themes";
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
    <Modal show={show} onHide={handleClose} centered>
      <Box className="dark:bg-dark-700 rounded-2 bg-white px-4 pt-7">
        <Box>
          <Heading
            as="h2"
            className="text-font dark:text-font-dark mb-7 text-center text-xl font-semibold md:text-2xl lg:text-3xl"
          >
            Add Collateral
          </Heading>
        </Box>
        <Box className="mb-3">
          <Flex className="flex flex-col gap-3">
            <Alert variant={"info"} className="flex items-start gap-2">
              <Box>
                <FontAwesomeIcon icon={faInfoCircle} />
              </Box>
              <Text>
                You can top up your collateral at any point by paying to your
                collateral address.
              </Text>
            </Alert>
          </Flex>
        </Box>
        <Box className="mb-4">
          <div className="d-flex justify-content-center align-items-center flex-column">
            <QRCode value={address} size={200} />
            <p className="text-break text-font dark:text-font-dark mt-2 text-center">
              <strong className="small">bitcoin:{address}</strong>
            </p>
          </div>
        </Box>
      </Box>
    </Modal>
  );
}
