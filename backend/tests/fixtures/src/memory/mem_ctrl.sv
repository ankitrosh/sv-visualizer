module mem_ctrl (
    input  logic clk,
    input  logic [15:0] addr,
    inout  logic [31:0] data
);

    cache u_cache (
        .clk(clk),
        .addr(addr[11:0]),
        .data(data)
    );

endmodule
