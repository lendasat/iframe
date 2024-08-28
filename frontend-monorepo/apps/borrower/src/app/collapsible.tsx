import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, { useState } from "react";

function CollapsibleComponent({ title, children }) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div>
      {title}{" "}
      <FontAwesomeIcon
        icon={isCollapsed ? faChevronDown : faChevronUp}
        onClick={toggleCollapse}
      />
      {!isCollapsed && <div className="collapsible-content">{children}</div>}
    </div>
  );
}

export default CollapsibleComponent;
