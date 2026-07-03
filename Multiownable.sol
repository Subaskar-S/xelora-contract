pragma solidity ^0.4.23;

/**
 * @title Multiownable
 * @author Subaskar Sivakumar
 * @dev Inheritable contract that allows multiple owners to collaborate and approve
 * transactions using a consensus threshold.
 */
contract Multiownable {
    // List of all owners
    address[] public owners;

    // Quick lookup to check if address is owner
    mapping(address => bool) public isOwner;

    // Threshold of required confirmations
    uint256 public required;

    // Mapping of operation hash to owner confirmations
    mapping(bytes32 => mapping(address => bool)) public confirmations;

    // Mapping of operation hash to confirmation counts
    mapping(bytes32 => uint256) public confirmationCount;

    // Mapping of operation hash to execution status
    mapping(bytes32 => bool) public executed;

    event Confirmation(address indexed sender, bytes32 indexed opHash);
    event Execution(bytes32 indexed opHash);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RequirementChanged(uint256 required);

    /**
     * @dev Modifier to allow execution only after threshold confirmations are met.
     * Calculates a hash of the function invocation (`keccak256(msg.data)`).
     */
    modifier onlyManyOwners(bytes32 opHash) {
        require(isOwner[msg.sender], "Sender must be an owner");
        require(!executed[opHash], "Operation already executed");

        if (!confirmations[opHash][msg.sender]) {
            confirmations[opHash][msg.sender] = true;
            confirmationCount[opHash]++;
            emit Confirmation(msg.sender, opHash);
        }

        if (confirmationCount[opHash] >= required) {
            executed[opHash] = true;
            _;
            emit Execution(opHash);
        }
    }

    /**
     * @dev Constructor sets initial owner as the deployer with a threshold of 1.
     * This provides backward-compatibility and prevents breaking inheritance constructors.
     */
    constructor() public {
        isOwner[msg.sender] = true;
        owners.push(msg.sender);
        required = 1;
        emit OwnerAdded(msg.sender);
        emit RequirementChanged(1);
    }

    /**
     * @notice Allows the current owners to add a new owner.
     * @param newOwner Address of the new owner
     */
    function addOwner(
        address newOwner
    )
        external
        onlyManyOwners(keccak256(abi.encodePacked("addOwner", newOwner)))
    {
        require(newOwner != address(0), "New owner cannot be zero");
        require(!isOwner[newOwner], "Address is already owner");

        isOwner[newOwner] = true;
        owners.push(newOwner);
        emit OwnerAdded(newOwner);
    }

    /**
     * @notice Allows the current owners to remove an owner.
     * @param owner Address of the owner to remove
     */
    function removeOwner(
        address owner
    )
        external
        onlyManyOwners(keccak256(abi.encodePacked("removeOwner", owner)))
    {
        require(isOwner[owner], "Address is not owner");
        require(owners.length > 1, "Cannot remove last owner");

        isOwner[owner] = false;
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.length--;
                break;
            }
        }

        if (required > owners.length) {
            required = owners.length;
            emit RequirementChanged(required);
        }
        emit OwnerRemoved(owner);
    }

    /**
     * @notice Allows the current owners to change the required confirmation threshold.
     * @param _required New threshold
     */
    function changeRequirement(
        uint256 _required
    )
        public
        onlyManyOwners(
            keccak256(abi.encodePacked("changeRequirement", _required))
        )
    {
        require(
            _required > 0 && _required <= owners.length,
            "Invalid confirmation requirement"
        );
        required = _required;
        emit RequirementChanged(_required);
    }

    /**
     * @notice Returns the list of current owners.
     */
    function getOwners() external view returns (address[]) {
        return owners;
    }
}
