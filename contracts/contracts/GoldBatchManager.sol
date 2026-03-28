// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract GoldBatchManager is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct GoldBatch {
        uint256 id;
        uint256 weight;       // grams
        uint256 purity;       // karat (24, 22, 18)
        string location;
        string certification;
        bool isPublic;
        uint256 timestamp;
        address addedBy;
    }

    mapping(uint256 => GoldBatch) public batches;
    uint256 public nextBatchId;

    event BatchAdded(uint256 indexed id, uint256 weight, bool isPublic, address addedBy);
    event BatchVisibilityUpdated(uint256 indexed id, bool newVisibility);
    event BatchRemoved(uint256 indexed id);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    modifier onlyAdmin() {
        require(hasRole(ADMIN_ROLE, msg.sender), "Not admin");
        _;
    }

    function addBatch(
        uint256 weight,
        uint256 purity,
        string memory location,
        string memory certification,
        bool isPublic
    ) external onlyAdmin {
        uint256 id = nextBatchId++;
        batches[id] = GoldBatch({
            id: id,
            weight: weight,
            purity: purity,
            location: location,
            certification: certification,
            isPublic: isPublic,
            timestamp: block.timestamp,
            addedBy: msg.sender
        });
        emit BatchAdded(id, weight, isPublic, msg.sender);
    }

    function updateBatchVisibility(uint256 id, bool newIsPublic) external onlyAdmin {
        require(batches[id].id != 0, "Batch not found");
        batches[id].isPublic = newIsPublic;
        emit BatchVisibilityUpdated(id, newIsPublic);
    }

    function removeBatch(uint256 id) external onlyAdmin {
        require(batches[id].id != 0, "Batch not found");
        delete batches[id];
        emit BatchRemoved(id);
    }

    function getBatch(uint256 id) external view returns (GoldBatch memory) {
        return batches[id];
    }

    function getTotalBatches() external view returns (uint256) {
        return nextBatchId;
    }
}
